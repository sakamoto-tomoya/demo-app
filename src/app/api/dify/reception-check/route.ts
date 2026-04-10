/**
 * Dify 受付ナレッジチェック Workflow
 * POST: 転記済みの受付データを送り、不足項目チェック結果を返す
 * エンドポイント: DIFY_RECEPTION_CHECK_URL（未設定時は …/v1/workflows/run）
 * APIキー: DIFY_RECEPTION_CHECK_API_KEY（ワークフローアプリのキー。Chatbot 用キーは不可）
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";

function defaultReceptionWorkflowUrl(): string {
  const base = process.env.DIFY_BASE_URL?.replace(/\/$/, "").trim();
  if (base) return `${base}/workflows/run`;
  return "https://api.dify.ai/v1/workflows/run";
}

function trim(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s).trim();
}

type Body = {
  reception_no?: string | null;
  shop_name?: string | null;
  shop_phone?: string | null;
  shop_fax?: string | null;
  shop_address?: string | null;
  shop_manager?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_phone?: string | null;
  model?: string | null;
  inquiry?: string | null;
  internal_note?: string | null;
};

export type ReceptionCheckResponse = {
  success: boolean;
  status: "ok" | "warning" | "error";
  message: string;
  raw?: unknown;
};

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const apiKey = process.env.DIFY_RECEPTION_CHECK_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      success: true,
      status: "ok" as const,
      message: "受付ナレッジチェックは未設定です。",
    } satisfies ReceptionCheckResponse);
  }

  /** 未設定時は DIFY_BASE_URL/workflows/run、それも無ければクラウド既定 */
  const workflowUrlRaw = process.env.DIFY_RECEPTION_CHECK_URL;
  const workflowUrl =
    typeof workflowUrlRaw === "string" && workflowUrlRaw.trim() !== ""
      ? workflowUrlRaw.trim()
      : defaultReceptionWorkflowUrl();

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const inputs = {
      reception_no: trim(body.reception_no),
      shop_name: trim(body.shop_name),
      shop_phone: trim(body.shop_phone),
      shop_fax: trim(body.shop_fax),
      shop_address: trim(body.shop_address),
      shop_manager: trim(body.shop_manager),
      customer_name: trim(body.customer_name),
      customer_address: trim(body.customer_address),
      customer_phone: trim(body.customer_phone),
      model: trim(body.model),
      inquiry: trim(body.inquiry),
      internal_note: trim(body.internal_note),
    };

    const res = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user: "reception",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      data?: { outputs?: Record<string, unknown>; text?: string };
      message?: string;
    };

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status: "error" as const,
        message: (data as { message?: string })?.message ?? `HTTP ${res.status}`,
        raw: data,
      } satisfies ReceptionCheckResponse);
    }

    // Dify の戻り値からメッセージを取得（outputs や text など）
    const outputs = data?.data?.outputs ?? (data as { outputs?: Record<string, unknown> }).outputs;
    const text = typeof data?.data?.text === "string" ? data.data.text : (data as { text?: string }).text;
    const resultText = (outputs && typeof (outputs as { result?: string }).result === "string")
      ? (outputs as { result: string }).result
      : text ?? JSON.stringify(data?.data ?? data);

    const lower = String(resultText).toLowerCase();
    const isWarning =
      lower.includes("不足") ||
      lower.includes("未入力") ||
      lower.includes("要確認") ||
      lower.includes("警告") ||
      lower.includes("確認してください");
    const isOk =
      lower.includes("登録できます") ||
      lower.includes("全項目") ||
      lower.includes("ok") ||
      lower.includes("問題ありません") ||
      !isWarning;

    return NextResponse.json({
      success: true,
      status: isWarning ? ("warning" as const) : isOk ? ("ok" as const) : ("warning" as const),
      message: typeof resultText === "string" ? resultText : JSON.stringify(resultText),
      raw: data?.data,
    } satisfies ReceptionCheckResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/dify/reception-check] error", message);
    return NextResponse.json({
      success: false,
      status: "error" as const,
      message,
    } satisfies ReceptionCheckResponse);
  }
}
