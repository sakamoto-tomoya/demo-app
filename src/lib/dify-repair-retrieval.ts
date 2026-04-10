import { normalizeModelForKnowledgeKey } from "@/lib/completion-detail";

export type RetrievedChunk = {
  segmentId: string;
  content: string;
  score: number;
  documentId?: string;
  /** 複数データセット検索時の出所 */
  sourceDatasetId?: string;
};

type DifyRetrieveRecord = {
  segment?: { id?: string; content?: string; document_id?: string };
  score?: number;
};

/**
 * ナレッジチャンクから【型式】行を読み取り、正規化した型式を返す（旧フォーマットは line「型式:」も許容）。
 */
export function extractModelFromKnowledgeChunk(content: string): string | null {
  const t = content.replace(/\r\n/g, "\n");
  const m = t.match(/【型式】\s*([^\n\r]*)/);
  if (m && m[1] !== undefined) {
    const v = normalizeModelForKnowledgeKey(m[1]);
    return v ? v : null;
  }
  const m2 = t.match(/^型式[\s:：]*([^\n\r]+)/m);
  if (m2 && m2[1] !== undefined) {
    const v = normalizeModelForKnowledgeKey(m2[1]);
    return v ? v : null;
  }
  return null;
}

export function chunkMatchesExactModel(content: string, modelNormalized: string): boolean {
  const extracted = extractModelFromKnowledgeChunk(content);
  if (extracted) return extracted === modelNormalized;
  // レガシー文書（【型式】行がない・表記ゆれ）: 行単位で正規化型式の完全一致
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;
    if (normalizeModelForKnowledgeKey(raw) === modelNormalized) return true;
    const m = raw.match(/^型式[\s:：]*(.+)$/);
    if (m?.[1] && normalizeModelForKnowledgeKey(m[1]) === modelNormalized) return true;
  }
  return false;
}

type RetrieveOpts = {
  top_k: number;
  score_threshold: number;
  score_threshold_enabled: boolean;
};

export async function fetchDatasetRetrieve(
  baseUrl: string,
  datasetId: string,
  apiKey: string,
  query: string,
  opts: RetrieveOpts
): Promise<RetrievedChunk[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/datasets/${datasetId}/retrieve`;
  const retrieval_model: Record<string, unknown> = {
    search_method: "semantic_search",
    reranking_enable: false,
    top_k: opts.top_k,
  };
  if (opts.score_threshold_enabled) {
    retrieval_model.score_threshold_enabled = true;
    retrieval_model.score_threshold = opts.score_threshold;
  } else {
    retrieval_model.score_threshold_enabled = false;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      retrieval_model,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    records?: DifyRetrieveRecord[];
  };
  if (!res.ok) {
    throw new Error(data?.message ?? `retrieve failed: HTTP ${res.status}`);
  }
  const records = data.records ?? [];
  const out: RetrievedChunk[] = [];
  for (const r of records) {
    const id = r.segment?.id;
    const content = r.segment?.content;
    if (!id || content === undefined || content === null) continue;
    const score = typeof r.score === "number" && !Number.isNaN(r.score) ? r.score : 0;
    out.push({
      segmentId: String(id),
      content: String(content),
      score,
      documentId: r.segment?.document_id ? String(r.segment.document_id) : undefined,
    });
  }
  return out;
}

/**
 * Step1: ベクトル候補のうち【型式】が入力型式と完全一致するものだけ残す。
 * Step2: 症状クエリと型式行クエリを並列で取り、セグメント単位でスコア最大を採用したうえで型式一致のみ残し、スコア順で上位 maxResults 件。
 */
export async function retrieveRepairKnowledgeTwoStage(
  baseUrl: string,
  datasetId: string,
  apiKey: string,
  modelNameRaw: string,
  symptomRaw: string,
  options?: { maxResults?: number; scoreThreshold?: number }
): Promise<{ chunks: RetrievedChunk[]; usedNoThresholdFallback: boolean }> {
  const modelNorm = normalizeModelForKnowledgeKey(modelNameRaw);
  if (!modelNorm) {
    return { chunks: [], usedNoThresholdFallback: false };
  }

  const symptom = (symptomRaw ?? "").trim();
  const symptomQuery = symptom || modelNorm;
  const modelLineQuery = `【型式】${modelNorm}`;

  const maxResults = options?.maxResults ?? 3;
  const strict = options?.scoreThreshold ?? 0.7;

  async function runOnce(
    threshold: number,
    topK: number,
    thresholdEnabled: boolean
  ): Promise<RetrievedChunk[]> {
    const opts: RetrieveOpts = {
      top_k: topK,
      score_threshold: threshold,
      score_threshold_enabled: thresholdEnabled,
    };
    const [bySymptom, byModelLine] = await Promise.all([
      fetchDatasetRetrieve(baseUrl, datasetId, apiKey, symptomQuery, opts),
      fetchDatasetRetrieve(baseUrl, datasetId, apiKey, modelLineQuery, opts),
    ]);
    const byId = new Map<string, RetrievedChunk>();
    for (const r of [...bySymptom, ...byModelLine]) {
      const prev = byId.get(r.segmentId);
      if (!prev || r.score > prev.score) byId.set(r.segmentId, r);
    }
    const merged = [...byId.values()];
    const filtered = merged.filter((c) => chunkMatchesExactModel(c.content, modelNorm));
    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, maxResults);
  }

  let usedNoThresholdFallback = false;
  let chunks = await runOnce(strict, 12, true);
  // ベクトルスコアが低いと 0.7 で API が0件になるため、しきい値なしで候補取得→型式で絞る（呼び出しは2ラウンドまで）
  if (chunks.length === 0) {
    usedNoThresholdFallback = true;
    chunks = await runOnce(0, 32, false);
  }
  return { chunks, usedNoThresholdFallback };
}

/**
 * Web完了登録ナレッジ（DIFY_KNOWLEDGE_DATASET_ID）と修理履歴ナレッジ（DIFY_REPAIR_HISTORY_DATASET_ID）など
 * 複数データセットを並列に検索し、型式一致チャンクをスコア順で全体上位 maxResults 件にまとめる。
 */
export async function retrieveRepairKnowledgeMultiDatasets(
  baseUrl: string,
  datasetIds: string[],
  apiKey: string,
  modelNameRaw: string,
  symptomRaw: string,
  options?: { maxResults?: number; scoreThreshold?: number; perDatasetMax?: number }
): Promise<{
  chunks: RetrievedChunk[];
  usedNoThresholdFallback: boolean;
  hitsByDatasetId: Record<string, number>;
}> {
  const unique = [...new Set(datasetIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { chunks: [], usedNoThresholdFallback: false, hitsByDatasetId: {} };
  }

  const maxTotal = options?.maxResults ?? 3;
  const perDatasetMax = options?.perDatasetMax ?? Math.max(maxTotal, 3);

  const runs = await Promise.all(
    unique.map(async (datasetId) => {
      const r = await retrieveRepairKnowledgeTwoStage(
        baseUrl,
        datasetId,
        apiKey,
        modelNameRaw,
        symptomRaw,
        {
          maxResults: perDatasetMax,
          scoreThreshold: options?.scoreThreshold ?? 0.7,
        }
      );
      return { datasetId, ...r };
    })
  );

  const usedNoThresholdFallback = runs.some((r) => r.usedNoThresholdFallback);
  const hitsByDatasetId: Record<string, number> = {};
  for (const r of runs) {
    hitsByDatasetId[r.datasetId] = r.chunks.length;
  }

  const combined: RetrievedChunk[] = [];
  for (const r of runs) {
    for (const c of r.chunks) {
      combined.push({
        ...c,
        segmentId: `${r.datasetId}:${c.segmentId}`,
        sourceDatasetId: r.datasetId,
      });
    }
  }
  combined.sort((a, b) => b.score - a.score);
  const chunks = combined.slice(0, maxTotal);

  return { chunks, usedNoThresholdFallback, hitsByDatasetId };
}
