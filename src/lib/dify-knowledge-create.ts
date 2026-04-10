/**
 * Dify ナレッジへテキストを新規登録（create_by_text のみ）
 */

const DIFY_CLOUD_V1 = "https://api.dify.ai/v1";

function buildProcessRule(processRuleMode: string | undefined) {
  if (processRuleMode === "completion_single_chunk") {
    return {
      mode: "custom" as const,
      rules: {
        pre_processing_rules: [{ id: "remove_extra_spaces", enabled: true }],
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

export type CreateDifyKnowledgeResult =
  | { ok: true; documentId: string }
  | { ok: false; message: string };

/** 環境変数が揃っていない場合は ok: false */
export async function createDifyKnowledgeDocument(
  text: string,
  name: string,
  processRuleMode: "completion_single_chunk" | undefined
): Promise<CreateDifyKnowledgeResult> {
  const baseUrl = (process.env.DIFY_BASE_URL?.replace(/\/$/, "").trim() || DIFY_CLOUD_V1).replace(/\/$/, "");
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
  const datasetId =
    process.env.DIFY_KNOWLEDGE_DATASET_ID?.trim() || process.env.DIFY_DATASET_ID?.trim();

  if (!apiKey || !datasetId) {
    return { ok: false, message: "Dify ナレッジ（DIFY_KNOWLEDGE_API_KEY / DIFY_KNOWLEDGE_DATASET_ID）が未設定です。" };
  }

  const createUrl = `${baseUrl}/datasets/${datasetId}/document/create_by_text`;
  const processRule = buildProcessRule(processRuleMode);

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name,
      text,
      indexing_technique: "high_quality",
      process_rule: processRule,
    }),
  });

  const createRaw = await createRes.text();
  let createData: { document?: { id?: string }; message?: string } = {};
  try {
    createData = JSON.parse(createRaw || "{}") as { document?: { id?: string }; message?: string };
  } catch {
    createData = {};
  }

  if (!createRes.ok) {
    const msg = createData?.message ?? createRaw?.slice(0, 200) ?? `HTTP ${createRes.status}`;
    return { ok: false, message: String(msg) };
  }

  const documentId = typeof createData?.document?.id === "string" ? createData.document.id : undefined;
  if (!documentId) {
    return { ok: false, message: "Dify が document.id を返しませんでした。" };
  }

  return { ok: true, documentId };
}
