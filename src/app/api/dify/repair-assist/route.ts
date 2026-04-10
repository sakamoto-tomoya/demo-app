import { NextRequest, NextResponse } from "next/server";
import { normalizeModelForKnowledgeKey } from "@/lib/completion-detail";
import {
  retrieveRepairKnowledgeMultiDatasets,
  type RetrievedChunk,
} from "@/lib/dify-repair-retrieval";
import { extractWorkflowAnswerText } from "@/lib/dify-workflow-response";

const DIFY_CLOUD_V1 = "https://api.dify.ai/v1";

/**
 * 修理アシスト用ワークフロー URL（未設定時は DIFY_BASE_URL + /workflows/run）
 */
function repairAssistWorkflowUrl(baseUrl: string): string {
  const u = process.env.DIFY_REPAIR_ASSIST_WORKFLOW_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return `${baseUrl}/workflows/run`;
}

/**
 * ワークフロー型アプリの API キー（Chat 用 DIFY_APP_API_KEY とは別。未設定時はフォールバック順）
 */
function repairAssistWorkflowApiKey(): string {
  return (
    process.env.DIFY_REPAIR_ASSIST_API_KEY?.trim() ||
    process.env.DIFY_RECEPTION_CHECK_API_KEY?.trim() ||
    process.env.DIFY_WORKFLOW_API_KEY?.trim() ||
    process.env.DIFY_CASE_WORKFLOW_API_KEY?.trim() ||
    process.env.DIFY_API_KEY?.trim() ||
    ""
  );
}

/**
 * POST /api/dify/repair-assist
 * 1) ナレッジ retrieve（設定時）→ 型式一致フィルタ後 上位3件
 * 2) Dify **ワークフロー** POST …/workflows/run（blocking）。チャット /chat-messages は使用しない。
 *
 * 環境変数は `npm run dev` 起動時に読み込まれる。`.env.local` 変更後はサーバー再起動。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const modelName = String((body as Record<string, unknown>).modelName ?? "").trim();
    const symptom = String((body as Record<string, unknown>).symptom ?? "").trim();

    if (!modelName) {
      return NextResponse.json({ error: "modelName が空です" }, { status: 400 });
    }

    const symptomLine = symptom || "（未入力）";
    const baseUserQuestion = `この型式（${modelName}）の過去の修理事例とよく使う部品を教えてください。\n症状：${symptomLine}`;

    const baseUrl = (process.env.DIFY_BASE_URL?.trim() || DIFY_CLOUD_V1).replace(/\/$/, "");
    const workflowApiKey = repairAssistWorkflowApiKey();
    const knowledgeApiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
    const datasetIds = [
      ...new Set(
        [
          process.env.DIFY_KNOWLEDGE_DATASET_ID?.trim(),
          process.env.DIFY_REPAIR_HISTORY_DATASET_ID?.trim(),
        ].filter((id): id is string => Boolean(id))
      ),
    ];
    if (datasetIds.length === 0) {
      const legacy =
        process.env.DIFY_REPAIR_ASSIST_DATASET_ID?.trim() || process.env.DIFY_DATASET_ID?.trim();
      if (legacy) datasetIds.push(legacy);
    }

    if (!workflowApiKey) {
      return NextResponse.json(
        {
          error:
            "ワークフロー用 API キーが未設定です（DIFY_REPAIR_ASSIST_API_KEY / DIFY_RECEPTION_CHECK_API_KEY / DIFY_WORKFLOW_API_KEY / DIFY_API_KEY のいずれか）。AI修理アシストはワークフロー型のキーが必要です。",
        },
        { status: 500 }
      );
    }

    let chunks: RetrievedChunk[] = [];
    let usedNoThresholdFallback = false;
    let hitsByDatasetId: Record<string, number> = {};
    let retrievalError: string | null = null;

    if (knowledgeApiKey && datasetIds.length > 0) {
      try {
        const r = await retrieveRepairKnowledgeMultiDatasets(
          baseUrl,
          datasetIds,
          knowledgeApiKey,
          modelName,
          symptom,
          { maxResults: 3, scoreThreshold: 0.3 }
        );
        chunks = r.chunks;
        usedNoThresholdFallback = r.usedNoThresholdFallback;
        hitsByDatasetId = r.hitsByDatasetId;
      } catch (e) {
        retrievalError = e instanceof Error ? e.message : String(e);
        console.error("[dify/repair-assist] retrieve failed", retrievalError);
      }
    } else {
      const missing: string[] = [];
      if (!knowledgeApiKey) missing.push("DIFY_KNOWLEDGE_API_KEY");
      if (datasetIds.length === 0) missing.push("DIFY_KNOWLEDGE_DATASET_ID または DIFY_REPAIR_HISTORY_DATASET_ID");
      retrievalError = `ナレッジ retrieve をスキップしました（未設定: ${missing.join(", ")}）。.env.local 設定後は dev サーバーを再起動してください。`;
      console.warn("[dify/repair-assist]", retrievalError);
    }

    const knowledgeBlock =
      chunks.length === 0
        ? "（参照ナレッジ候補は0件です。型式【" +
          normalizeModelForKnowledgeKey(modelName) +
          "】に一致するチャンクが見つからないか、スコアしきい値を満たしませんでした。）"
        : chunks
            .map(
              (c, i) =>
                `--- 参照${i + 1} (relevance ${c.score.toFixed(3)}) ---\n${c.content.trim()}`
            )
            .join("\n");

    const fullQuery = [
      "以下はナレッジ検索で抽出したテキストです（データセット: " +
        datasetIds.join(", ") +
        "。型式完全一致でフィルタ後、症状に近い順で最大3件。スコアしきい値0.3、0件時はしきい値なしで再検索）。",
      "",
      knowledgeBlock,
      "",
      "---",
      "【依頼】",
      baseUserQuestion,
    ].join("\n");

    const inputs: Record<string, string> = {
      request_text: fullQuery,
      manufacturer: "",
      model_name: modelName,
    };

    const workflowUrl = repairAssistWorkflowUrl(baseUrl);

    const res = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workflowApiKey}`,
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user: "repair-assist-web",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[dify/repair-assist] Dify workflow error", res.status, data);
      return NextResponse.json(
        {
          error:
            (data as { message?: string })?.message ?? "Dify ワークフローへのリクエストに失敗しました",
          details: data,
          retrieval: {
            hitCount: chunks.length,
            datasetIds,
            hitsByDatasetId,
            scores: chunks.map((c) => c.score),
            usedNoThresholdFallback,
            retrievalError,
          },
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
      );
    }

    const answerText = extractWorkflowAnswerText(data) ?? "(回答なし)";

    return NextResponse.json({
      ...data,
      answer: answerText,
      retrieval: {
        hitCount: chunks.length,
        datasetIds,
        hitsByDatasetId,
        scores: chunks.map((c) => c.score),
        usedNoThresholdFallback,
        retrievalError,
        chunksPreview: chunks.map((c) => ({
          score: c.score,
          sourceDatasetId: c.sourceDatasetId,
          contentHead: c.content.slice(0, 200),
        })),
      },
    });
  } catch (err) {
    console.error("[dify/repair-assist] Unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
