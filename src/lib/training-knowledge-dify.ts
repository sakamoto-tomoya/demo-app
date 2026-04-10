/**
 * 「この内容で学習登録」→ Dify ナレッジ用テキスト（個人情報・問合全文は含めない）
 */

export type TrainingKnowledgeDifyFields = {
  /** 型式（正規化しない。前後空白のみ trim して空判定・【型式】行に使用） */
  model: string;
  /** 症状（完了内訳の症状分類など短文） */
  symptom: string;
  confirmed_cause: string;
  solution_summary: string;
  part_number: string;
  work_result: string;
};

/** 型式が空のときは学習登録（ナレッジ）不可 */
export function validateTrainingKnowledgeModel(model: unknown): { ok: true; modelForLine: string } | { ok: false; error: string } {
  const raw = model === undefined || model === null ? "" : String(model);
  const modelForLine = raw.trim();
  if (!modelForLine) {
    return { ok: false, error: "型式が未入力のため学習登録（ナレッジ）をスキップしました。" };
  }
  return { ok: true, modelForLine };
}

function fieldLine(label: string, value: string): string {
  const t = value.trim();
  return `【${label}】${t === "" ? "(未入力)" : t}`;
}

/**
 * 6行＋末尾 `---` のみ。1案件＝1チャンク用（本文に \\n\\n を含めない）。
 */
export function buildTrainingKnowledgeTextForDify(
  fields: TrainingKnowledgeDifyFields
): { ok: true; text: string } | { ok: false; error: string } {
  const m = validateTrainingKnowledgeModel(fields.model);
  if (!m.ok) return { ok: false, error: m.error };
  const text = [
    `【型式】${m.modelForLine}`,
    fieldLine("症状", fields.symptom),
    fieldLine("確定原因", fields.confirmed_cause),
    fieldLine("解決方法要約", fields.solution_summary),
    fieldLine("使用部品品番", fields.part_number),
    fieldLine("作業結果", fields.work_result),
    "---",
  ].join("\n");
  return { ok: true, text };
}
