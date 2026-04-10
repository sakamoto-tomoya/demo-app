import { NextRequest, NextResponse } from "next/server";
import {
  buildReceptionQueryText,
  type DifyChatQueryIntent,
} from "@/lib/dify-chat-query";

const DEFAULT_INTENT: DifyChatQueryIntent = "solution";

const INTENT_MAP: Record<string, DifyChatQueryIntent> = {
  solution: "solution",
  cause: "cause",
  parts: "parts",
};

/**
 * POST /api/dify
 * Dify チャット API に受付情報ベースの事前検索クエリを送信し、blocking で回答を返す。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (typeof body !== "object" || body === null) {
      console.error("[dify] Invalid body: not an object");
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const modelName = String((body as Record<string, unknown>).case_model ?? "").trim();
    const reportedModelName = String((body as Record<string, unknown>).case_reported_model ?? "").trim();
    const gasType = String((body as Record<string, unknown>).case_gas_type ?? "").trim();
    const content = String((body as Record<string, unknown>).case_inquiry ?? "").trim();
    const rawIntent = (body as Record<string, unknown>).query_intent;
    const intent: DifyChatQueryIntent =
      typeof rawIntent === "string" && INTENT_MAP[rawIntent]
        ? INTENT_MAP[rawIntent]
        : DEFAULT_INTENT;

    const queryText = buildReceptionQueryText({
      modelName,
      reportedModelName,
      gasType,
      content,
      intent,
    });

    console.log("[dify] 送信直前の最終本文:");
    console.log("=== Dify chat query (reception) start ===");
    console.log(queryText);
    console.log("=== Dify chat query (reception) end ===");

    const inputs = {
      case_search_text: content,
      case_model: modelName,
      case_inquiry: content,
      case_used_parts: "",
      case_work_detail: "",
      case_note: "",
    };

    const baseUrl = process.env.DIFY_BASE_URL?.trim();
    const apiKey = process.env.DIFY_APP_API_KEY?.trim();

    if (!baseUrl) {
      console.error("[dify] DIFY_BASE_URL is not configured");
      return NextResponse.json(
        { error: "DIFY_BASE_URL が未設定です（チャットAPI）" },
        { status: 500 }
      );
    }
    if (!apiKey) {
      console.error("[dify] DIFY_APP_API_KEY is not configured");
      return NextResponse.json(
        { error: "チャットAPIキー未設定（DIFY_APP_API_KEY）" },
        { status: 500 }
      );
    }

    const url = `${baseUrl.replace(/\/$/, "")}/chat-messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs,
        query: queryText,
        response_mode: "blocking",
        user: "vercel-web-user",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[dify] Dify API error", res.status, data);
      return NextResponse.json(
        { error: (data as any)?.message ?? "Dify request failed", details: data },
        { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[dify] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}