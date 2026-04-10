import type { CompletionDetail } from "./types";

const MANUFACTURER_FIXED = "パロマ";

export const REQUIRED_FIELDS = [
  "model",
  "inquiry_content",
  "symptom_category",
  "confirmed_cause",
  "work_detail",
  "solution_summary",
] as const;

export type CompletionDetailValidationError = {
  field: keyof CompletionDetail;
  message: string;
};

// --- 正規化用ヘルパー（Difyナレッジ検索精度向上のため表記ゆれを減らす） ---

/** 全角英数字を半角に変換 */
function fullwidthToHalfwidthAlnum(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 全角ハイフン・マイナスを半角ハイフンに統一（－ U+FF0D など） */
function normalizeHyphen(s: string): string {
  return s.replace(/－/g, "-").replace(/ー/g, "-");
}

/** 連続スペースを1つに */
function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 連続改行を1つにし、前後の空白も整理 */
function collapseNewlines(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * 型式の表記をナレッジ照合用に正規化（完全一致比較用）。
 * 完了詳細の model と同じルール。
 */
export function normalizeModelForKnowledgeKey(s: string): string {
  return collapseSpaces(
    normalizeHyphen(fullwidthToHalfwidthAlnum(String(s ?? "").trim())).toUpperCase()
  );
}

/**
 * 完了詳細の正規化（保存前に実行）。
 * Difyナレッジ検索の精度向上のため、型式・部品番号・文章の表記ゆれを減らす。
 * 渡したオブジェクトは変更せず、正規化したコピーを返す。
 */
export function normalizeCompletionDetail(
  raw: Partial<CompletionDetail> | null | undefined
): Partial<CompletionDetail> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw;

  // model: 前後空白削除 / 英字大文字 / 全角→半角 / 全角ハイフン→半角 / 連続スペース→1つ
  const model = collapseSpaces(
    normalizeHyphen(fullwidthToHalfwidthAlnum(String(o.model ?? "").trim())).toUpperCase()
  );

  // part_number: 前後空白削除 / 全角→半角 / 全角ハイフン→半角 / 英字大文字
  const part_number = normalizeHyphen(fullwidthToHalfwidthAlnum(String(o.part_number ?? "").trim())).toUpperCase();

  // 文章系: 前後空白削除 / 連続改行整理 / 連続スペース整理
  const normalizeText = (v: string | undefined) =>
    collapseSpaces(collapseNewlines(String(v ?? "").trim()));

  const inquiry_content = normalizeText(o.inquiry_content);
  const confirmed_cause = normalizeText(o.confirmed_cause);
  const work_detail = normalizeText(o.work_detail);
  const note = normalizeText(o.note);
  const solution_summary = normalizeText(o.solution_summary);

  return {
    ...o,
    model,
    part_number,
    inquiry_content,
    confirmed_cause,
    work_detail,
    note,
    solution_summary,
    category: String(o.category ?? "").trim(),
    symptom_category: String(o.symptom_category ?? "").trim(),
    part_name: String(o.part_name ?? "").trim(),
    work_result: String(o.work_result ?? "").trim(),
  };
}

/**
 * 完了詳細のバリデーション。
 * 必須: model, inquiry_content, symptom_category, confirmed_cause, work_detail, solution_summary
 */
export function validateCompletionDetail(
  raw: Partial<CompletionDetail> | null | undefined
): CompletionDetailValidationError[] {
  const errors: CompletionDetailValidationError[] = [];
  if (!raw || typeof raw !== "object") {
    return [{ field: "model", message: "完了詳細を入力してください。" }];
  }

  const model = (raw.model ?? "").trim();
  if (!model) errors.push({ field: "model", message: "型式は必須です。" });

  const inquiry_content = (raw.inquiry_content ?? "").trim();
  if (!inquiry_content)
    errors.push({ field: "inquiry_content", message: "問合内容は必須です。" });

  const symptom_category = (raw.symptom_category ?? "").trim();
  if (!symptom_category)
    errors.push({ field: "symptom_category", message: "症状分類は必須です。" });

  const confirmed_cause = (raw.confirmed_cause ?? "").trim();
  if (!confirmed_cause)
    errors.push({ field: "confirmed_cause", message: "確定原因は必須です。" });

  const work_detail = (raw.work_detail ?? "").trim();
  if (!work_detail)
    errors.push({ field: "work_detail", message: "作業内容は必須です。" });

  const solution_summary = (raw.solution_summary ?? "").trim();
  if (!solution_summary)
    errors.push({ field: "solution_summary", message: "解決方法要約は必須です。（1文で簡潔に）" });

  return errors;
}

/**
 * 案件レコードなどから CompletionDetail を組み立てる（保存用）。
 * 保存前に必ず normalizeCompletionDetail を通すため、保存される値は常に正規化済み。
 * manufacturer は固定「パロマ」、is_completed は true で保存。
 */
export function buildCompletionDetail(
  raw: Partial<CompletionDetail> | null | undefined,
  options?: { is_completed?: boolean }
): CompletionDetail {
  const o = normalizeCompletionDetail(raw && typeof raw === "object" ? raw : {});
  const isCompleted = options?.is_completed ?? true;
  return {
    manufacturer: MANUFACTURER_FIXED,
    category: String(o.category ?? "").trim(),
    model: String(o.model ?? "").trim(),
    inquiry_content: String(o.inquiry_content ?? "").trim(),
    symptom_category: String(o.symptom_category ?? "").trim(),
    confirmed_cause: String(o.confirmed_cause ?? "").trim(),
    part_number: String(o.part_number ?? "").trim(),
    part_name: String(o.part_name ?? "").trim(),
    work_detail: String(o.work_detail ?? "").trim(),
    work_result: String(o.work_result ?? "").trim(),
    note: String(o.note ?? "").trim(),
    solution_summary: String(o.solution_summary ?? "").trim(),
    is_completed: isCompleted,
  };
}

/**
 * Dify ナレッジ用テキスト（1案件＝1チャンク想定）。
 * 問合内容・社内連絡・訪問日程などのノイズは含めない。
 * 区切りは --- 。本文中に \\n\\n を入れない（単一チャンク分割を避ける）。
 */
export type UsedPartRowForDify = { partNo: string; partName: string; qty: number; orderNo?: string };

export function formatCompletionDetailForDify(
  d: CompletionDetail | Partial<CompletionDetail> | null | undefined,
  opts?: { usedParts?: UsedPartRowForDify[] }
): string {
  const o = normalizeCompletionDetail(d && typeof d === "object" ? d : {});
  const model = (o.model ?? "").trim() || "(未入力)";
  const symptom = (o.symptom_category ?? "").trim() || "(未入力)";
  const cause = (o.confirmed_cause ?? "").trim() || "(未入力)";
  const solution = (o.solution_summary ?? "").trim() || "(未入力)";
  const partNo = (o.part_number ?? "").trim() || "(未入力)";
  const partNameSingle = (o.part_name ?? "").trim() || "(未入力)";
  const lines = [
    "---",
    `【型式】${model}`,
    `【症状分類】${symptom}`,
    `【確定原因】${cause}`,
    `【解決方法】${solution}`,
    `【使用部品品番】${partNo}`,
    `【使用部品名】${partNameSingle}`,
  ];
  const rows = opts?.usedParts?.filter((r) => (r.partNo ?? "").trim()) ?? [];
  if (rows.length > 0) {
    const block = rows
      .map((r) => {
        const pn = (r.partNo ?? "").trim();
        const name = (r.partName ?? "").trim() || "—";
        const q = r.qty != null && !Number.isNaN(r.qty) ? r.qty : 0;
        return `${pn}${q > 0 ? ` ×${q}` : ""} ${name}`.trim();
      })
      .join("\n");
    lines.push(`【使用部品一覧】\n${block}`);
  }
  lines.push("---");
  return lines.join("\n");
}
