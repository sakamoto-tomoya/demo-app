import { NextRequest, NextResponse } from "next/server";
import { getEmailConfigForDisplay, saveEmailConfig } from "@/lib/email-config";
import { requireSettingsAuth } from "@/lib/settings-auth";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_HOST = 253;
const MAX_USER = 256;
const MAX_FROM = 256;

/** メール設定を取得（パスワードは返さない） */
export async function GET(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = getEmailConfigForDisplay();
  if (!config) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({
    configured: true,
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    hasPassword: config.hasPassword,
    source: config.source,
  });
}

/** メール設定を保存（.env より優先されるファイルに保存） */
export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode) {
    return NextResponse.json({ error: "デモモードでは設定の変更はできません" }, { status: 403 });
  }
  let body: { host?: string; port?: number; user?: string; pass?: string; from?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const host = String(body?.host ?? "").trim();
  const user = String(body?.user ?? "").trim();
  const from = String(body?.from ?? "").trim();
  if (!host || !user) {
    return NextResponse.json({ error: "host and user are required" }, { status: 400 });
  }
  if (host.length > MAX_HOST || user.length > MAX_USER || from.length > MAX_FROM) {
    return NextResponse.json({ error: "入力が長すぎます" }, { status: 400 });
  }
  const port = Number(body?.port);
  if (body?.port != null && (Number.isNaN(port) || port < 1 || port > 65535)) {
    return NextResponse.json({ error: "port は 1〜65535 の範囲で指定してください" }, { status: 400 });
  }
  try {
    saveEmailConfig({
      host,
      port: Number(body?.port) || 587,
      user,
      pass: body?.pass !== undefined ? String(body.pass) : undefined,
      from: from || user,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/email]", err instanceof Error ? err.message : "error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 500 }
    );
  }
}
