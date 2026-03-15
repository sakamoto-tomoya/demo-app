import { getEffectivePassword } from "@/lib/settings-password";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const COOKIE_NAME = "settings_access";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24時間

/**
 * 設定・部品管理のアクセス制御（管理者パスワード）。
 * 本番でパスワード未設定の場合は認証不可（設定を外部公開しない）。
 */
/** 設定ページの認証状態を確認 */
export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;
  const expected = getEffectivePassword();
  if (process.env.NODE_ENV === "production" && (!expected || expected === "")) {
    return NextResponse.json({ ok: false, unconfigured: true }, { status: 401 });
  }
  if (!expected || expected === "") {
    return NextResponse.json({ ok: true });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token === "1") {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

/** パスワードを検証し、正しければCookieを発行 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;
  const expected = getEffectivePassword();
  if (process.env.NODE_ENV === "production" && (!expected || expected === "")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!expected || expected === "") {
    return NextResponse.json({ ok: true });
  }
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const password = String(body?.password ?? "").trim();
  if (password !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
