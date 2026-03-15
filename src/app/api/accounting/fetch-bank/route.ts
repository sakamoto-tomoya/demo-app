import { NextRequest, NextResponse } from "next/server";
import { requireAccountingAuth } from "@/lib/accounting-auth-server";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

/** 銀行API等から返す想定の入金1件の形式 */
export type BankPaymentItem = {
  invoiceDate?: string;
  receptionNo?: string;
  specifiedNo?: string;
  recipientName?: string;
  postalCode?: string;
  amount?: string | number;
};

function normalizePayment(raw: BankPaymentItem): BankPaymentItem & { _valid: boolean } {
  const invoiceDate = String(raw?.invoiceDate ?? "").trim();
  const receptionNo = String(raw?.receptionNo ?? "").trim();
  const specifiedNo = String(raw?.specifiedNo ?? "").trim();
  const recipientName = String(raw?.recipientName ?? "").trim();
  const postalCode = String(raw?.postalCode ?? "").trim();
  const amount = raw?.amount != null ? String(raw.amount) : "";
  const valid =
    invoiceDate !== "" &&
    receptionNo !== "" &&
    specifiedNo !== "" &&
    recipientName !== "" &&
    postalCode !== "" &&
    amount !== "";
  return {
    invoiceDate,
    receptionNo,
    specifiedNo,
    recipientName,
    postalCode,
    amount,
    _valid: valid,
  };
}

/**
 * 入金取得: 指定URL（銀行APIなど）からJSONを取得し、入金データ形式で返す。
 * 経理担当者のみ利用可能。
 * POST body: { url: string, apiKey?: string }
 * レスポンス: { payments: Array<{ invoiceDate, receptionNo, specifiedNo, recipientName, postalCode, amount }>, error?: string }
 */
export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  const auth = await requireAccountingAuth();
  if (!auth) {
    return NextResponse.json({ error: "経理担当者のログインが必要です" }, { status: 401 });
  }
  if (isDemoMode) {
    return NextResponse.json({ error: "デモモードでは入金取得を利用できません。", payments: [] }, { status: 403 });
  }
  let body: { url?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const urlRaw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!urlRaw) {
    return NextResponse.json({ error: "url を指定してください" }, { status: 400 });
  }
  if (urlRaw.length > 2048) {
    return NextResponse.json({ error: "url が長すぎます" }, { status: 400 });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlRaw);
  } catch {
    return NextResponse.json({ error: "有効なURLを指定してください" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "https のURLのみ指定できます", payments: [] }, { status: 400 });
  }
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (body.apiKey) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${body.apiKey}`;
    }
    const res = await fetch(parsedUrl.toString(), { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "取得に失敗しました。URLとネットワークをご確認ください。", payments: [] },
        { status: 200 }
      );
    }
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : Array.isArray(data?.payments) ? data.payments : [];
    const payments = rawList
      .map((item: unknown) => normalizePayment(item as BankPaymentItem))
      .filter((p: { _valid: boolean }) => p._valid)
      .map((p: BankPaymentItem & { _valid: boolean }) => {
        const { _valid, ...rest } = p;
        return rest;
      });
    return NextResponse.json({ payments });
  } catch (err) {
    console.error("[fetch-bank]", err instanceof Error ? err.message : "error");
    return NextResponse.json(
      { error: "取得に失敗しました。URLをご確認ください。", payments: [] },
      { status: 200 }
    );
  }
}
