import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const headers = (apiKey: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
});

function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

type DifyErrorBody = { code?: string; message?: string; [key: string]: unknown };
type DifyCreateDoc = { id?: string; [key: string]: unknown };
type DifyCreateResponse = { document?: DifyCreateDoc; batch?: string; [key: string]: unknown };
type IndexingStatusItem = { id?: string; indexing_status?: string; error?: string | null; [key: string]: unknown };

/**
 * POST /api/dify/knowledge
 * 完了詳細テキストを Dify ナレッジに追加または更新する。
 * - documentId あり: 既存文書を update-by-text で更新。失敗時は削除→新規作成。
 * - documentId なし: 新規 create_by_text。
 * - processRuleMode: "completion_single_chunk" のとき custom 分割（1案件1チャンク想定）。
 * 戻り値: { ok, status, difyResponse, documentId?, contentHash?, batch?, indexingStatus? }
 */
const DIFY_CLOUD_V1 = "https://api.dify.ai/v1";

/** 完了案件テキストは \\n\\n を含めず1チャンクにしやすくする（区切りは custom のみ） */
function buildProcessRule(processRuleMode: string | undefined) {
  if (processRuleMode === "completion_single_chunk") {
    return {
      mode: "custom" as const,
      rules: {
        segmentation: {
          separator: "\n\n",
          max_tokens: 8192,
          chunk_overlap: 0,
        },
      },
    };
  }
  return { mode: "automatic" as const };
}

export async function POST(request: NextRequest) {
  const baseUrl =
    process.env.DIFY_BASE_URL?.replace(/\/$/, "").trim() || DIFY_CLOUD_V1;
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
  const datasetId =
    process.env.DIFY_KNOWLEDGE_DATASET_ID?.trim() ||
    process.env.DIFY_DATASET_ID?.trim();

  if (!apiKey || !datasetId) {
    console.error("[dify/knowledge] Missing env: apiKey=", !!apiKey, "datasetId=", !!datasetId);
    return NextResponse.json(
      {
        ok: false,
        status: 500,
        difyResponse: {
          code: "config_error",
          message: !apiKey
            ? "DIFY_KNOWLEDGE_API_KEY が未設定です"
            : "DIFY_KNOWLEDGE_DATASET_ID（または DIFY_DATASET_ID）が未設定です",
        },
      },
      { status: 200 }
    );
  }

  console.log("[dify/knowledge] dataset_id=", datasetId, "endpoint=create_by_text", "apiKey=", maskApiKey(apiKey));

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { ok: false, status: 400, difyResponse: { code: "invalid_body", message: "Invalid request body" } },
        { status: 200 }
      );
    }
    const textRaw = (body as { text?: string }).text;
    const text = String(textRaw !== undefined && textRaw !== null ? textRaw : "").trim();
    const nameRaw = (body as { name?: string }).name;
    const name = String(nameRaw !== undefined && nameRaw !== null ? nameRaw : "").trim();
    const documentId = typeof (body as { documentId?: string }).documentId === "string"
      ? (body as { documentId: string }).documentId.trim()
      : undefined;
    const processRuleMode =
      typeof (body as { processRuleMode?: string }).processRuleMode === "string"
        ? (body as { processRuleMode: string }).processRuleMode.trim()
        : undefined;
    const processRule = buildProcessRule(processRuleMode);

    if (!text) {
      return NextResponse.json(
        { ok: false, status: 400, difyResponse: { code: "validation", message: "text is required" } },
        { status: 200 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { ok: false, status: 400, difyResponse: { code: "validation", message: "name is required" } },
        { status: 200 }
      );
    }

    const hash = contentHash(text);

    if (documentId) {
      const updateUrl = `${baseUrl}/datasets/${datasetId}/documents/${documentId}/update-by-text`;
      const updateRes = await fetch(updateUrl, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          name,
          text,
          process_rule: processRule,
        }),
      });
      const updateRaw = await updateRes.text();
      let updateData: DifyCreateResponse & DifyErrorBody = {};
      try {
        updateData = JSON.parse(updateRaw || "{}") as DifyCreateResponse & DifyErrorBody;
      } catch {
        updateData = {};
      }
      console.log("[dify/knowledge] update response status=", updateRes.status, "body=", updateRaw?.slice(0, 500));

      if (updateRes.ok && updateData?.document?.id) {
        const batch = typeof updateData.batch === "string" ? updateData.batch : undefined;
        let indexingStatus: string | undefined;
        if (batch) {
          const statusUrl = `${baseUrl}/datasets/${datasetId}/documents/${batch}/indexing-status`;
          const statusRes = await fetch(statusUrl, { method: "GET", headers: headers(apiKey) });
          const statusRaw = await statusRes.text();
          let statusData: { data?: IndexingStatusItem[] } = {};
          try {
            statusData = JSON.parse(statusRaw || "{}") as { data?: IndexingStatusItem[] };
          } catch {
            statusData = {};
          }
          const first = statusData?.data?.[0];
          const idxStatus = first?.indexing_status;
          indexingStatus = idxStatus !== undefined && idxStatus !== null ? idxStatus : (first?.error ? "error" : undefined);
          console.log("[dify/knowledge] indexing-status batch=", batch, "indexing_status=", indexingStatus);
        }
        return NextResponse.json({
          ok: true,
          status: updateRes.status,
          difyResponse: updateData,
          documentId: updateData.document!.id,
          contentHash: hash,
          updated: true,
          batch,
          indexingStatus,
        });
      }
      if (updateRes.status >= 400 && updateRes.status < 500) {
        const delUrl = `${baseUrl}/datasets/${datasetId}/documents/${documentId}`;
        await fetch(delUrl, { method: "DELETE", headers: headers(apiKey) });
      }
    }

    const createUrl = `${baseUrl}/datasets/${datasetId}/document/create_by_text`;
    console.log(
      "[dify/knowledge] POST createUrl=",
      createUrl,
      "name.length=",
      name.length,
      "text.length=",
      text.length
    );
    console.log("=== Dify text start ===");
    console.log(text);
    console.log("=== Dify text end ===");

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        name,
        text,
        indexing_technique: "high_quality",
        process_rule: processRule,
      }),
    });
    const createRaw = await createRes.text();
    let createData: DifyCreateResponse & DifyErrorBody = {};
    try {
      createData = JSON.parse(createRaw || "{}");
    } catch {
      createData = {};
    }
    console.log("[dify/knowledge] create response status=", createRes.status, "body=", createRaw?.slice(0, 800));

    if (!createRes.ok) {
      const codeVal = (createData as DifyErrorBody).code;
      const code = codeVal !== undefined && codeVal !== null ? codeVal : "dify_error";
      const bodyMessage = (createData as DifyErrorBody).message;
      let message: string;
      if (bodyMessage !== undefined && bodyMessage !== null) {
        message = String(bodyMessage);
      } else if (createRaw && createRaw.length > 0) {
        message = createRaw;
      } else {
        message = "Dify knowledge request failed";
      }
      console.error("[dify/knowledge] create API error status=", createRes.status, "code=", code, "message=", message);
      return NextResponse.json({
        ok: false,
        status: createRes.status,
        difyResponse: { code: String(code), message: String(message), raw: createRaw?.slice(0, 500) },
      }, { status: 200 });
    }

    const newDocumentId =
      typeof createData?.document?.id === "string" ? createData.document.id : undefined;
    const batch = typeof createData?.batch === "string" ? createData.batch : undefined;

    if (!newDocumentId) {
      console.error("[dify/knowledge] create 200 but no document.id in response:", createRaw?.slice(0, 500));
      return NextResponse.json({
        ok: false,
        status: createRes.status,
        difyResponse: { code: "no_document_id", message: "Dify returned 200 but no document.id", raw: createRaw?.slice(0, 500) },
      }, { status: 200 });
    }

    let indexingStatus: string | undefined;
    if (batch) {
      const statusUrl = `${baseUrl}/datasets/${datasetId}/documents/${batch}/indexing-status`;
      try {
        const statusRes = await fetch(statusUrl, { method: "GET", headers: headers(apiKey) });
        const statusRaw = await statusRes.text();
        let statusData: { data?: IndexingStatusItem[] } = {};
        try {
          statusData = JSON.parse(statusRaw || "{}") as { data?: IndexingStatusItem[] };
        } catch {
          statusData = {};
        }
        const first = statusData?.data?.[0];
        const idxStatus = first?.indexing_status;
        indexingStatus = idxStatus !== undefined && idxStatus !== null ? idxStatus : (first?.error ? "error" : "waiting");
        console.log("[dify/knowledge] indexing-status batch=", batch, "indexing_status=", indexingStatus);
      } catch (e) {
        console.warn("[dify/knowledge] indexing-status fetch failed", e);
        indexingStatus = "unknown";
      }
    }

    // 作成後の一覧に存在するか確認（keyword=name で1件取得）
    try {
      const listUrl = `${baseUrl}/datasets/${datasetId}/documents?page=1&limit=20`;
      const listRes = await fetch(listUrl, { method: "GET", headers: headers(apiKey) });
      const listRaw = await listRes.text();
      let listData: { data?: { id?: string }[] } = {};
      try {
        listData = JSON.parse(listRaw || "{}") as { data?: { id?: string }[] };
      } catch {
        listData = {};
      }
      const found = listData?.data?.some((d) => d.id === newDocumentId);
      console.log("[dify/knowledge] documents list check docId=", newDocumentId, "found=", found);
    } catch (e) {
      console.warn("[dify/knowledge] documents list fetch failed", e);
    }

    return NextResponse.json({
      ok: true,
      status: createRes.status,
      difyResponse: createData,
      documentId: newDocumentId,
      contentHash: hash,
      updated: false,
      batch,
      indexingStatus,
    });
  } catch (err) {
    console.error("[dify/knowledge] Unexpected error", err);
    return NextResponse.json(
      {
        ok: false,
        status: 500,
        difyResponse: {
          code: "internal_error",
          message: err instanceof Error ? err.message : "Internal server error",
        },
      },
      { status: 200 }
    );
  }
}
