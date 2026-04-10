/**
 * 問合／依頼内容の半構造パターン解析
 * 10件PDFで繰り返し出る定型: 先頭行=型式候補、以降は「ラベル: 値」形式
 * 全角/半角コロン・空白違いに強くする
 */

export type ParsedInquiry = {
  /** 元の問合テキスト（そのまま保持） */
  inquiry_raw: string;
  /** 先頭行から抽出した型式候補 */
  model_candidate: string;
  symptom: string;
  usage_years_note: string;
  contact_datetime_note: string;
  preferred_visit_note: string;
  fee_explanation_note: string;
};

const EMPTY_PARSED: ParsedInquiry = {
  inquiry_raw: "",
  model_candidate: "",
  symptom: "",
  usage_years_note: "",
  contact_datetime_note: "",
  preferred_visit_note: "",
  fee_explanation_note: "",
};

/** ラベルと内部キーの対応（出現順で切り出し）。全角/半角コロン・括弧・空白に強くする */
const LABELS: { pattern: RegExp; key: keyof Omit<ParsedInquiry, "inquiry_raw" | "model_candidate"> }[] = [
  { pattern: /症状\s*[：:]\s*/u, key: "symptom" },
  { pattern: /使用年数\s*[（(]\s*購入\s*日\s*[)）]\s*[：:　\s]*/u, key: "usage_years_note" },
  { pattern: /連絡日時\s*[：:]\s*/u, key: "contact_datetime_note" },
  { pattern: /訪問希望日\s*[：:]\s*/u, key: "preferred_visit_note" },
  { pattern: /費用説明\s*[：:]\s*/u, key: "fee_explanation_note" },
];

/** 全角コロン・空白を正規化（OCR崩れ対策） */
function normalizeForParse(s: string): string {
  return s
    .replace(/\u3000/g, " ")
    .replace(/[　]+/g, " ")
    .replace(/[：]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

/** 先頭行から型式候補を取得（「問合/依頼内容」等のラベルを除き、英数字・ハイフン・括弧中心で最大長） */
function takeModelCandidate(firstLine: string): string {
  let t = normalizeForParse(firstLine).slice(0, 80);
  t = t.replace(/^問合\s*[／\/]\s*依頼内容\s*/, "").replace(/^依頼内容\s*/, "").trim();
  const m = t.match(/^[\s\d\-A-Za-z\u30a0-\u30ff\u3040-\u309f\u4e00-\u9faf()（）]*/);
  const raw = (m ? m[0] : t).trim();
  return raw.slice(0, 40);
}

/**
 * 問合／依頼内容の raw テキストを半構造で分解する
 * - inquiry_raw: そのまま保持
 * - 先頭行 → model_candidate
 * - 症状 / 使用年数（購入日）/ 連絡日時 / 訪問希望日 / 費用説明 で値を分解
 */
export function parseInquirySemiStructured(raw: string): ParsedInquiry {
  const inquiry_raw = raw ?? "";
  const normalized = normalizeForParse(inquiry_raw);
  if (!normalized) return { ...EMPTY_PARSED, inquiry_raw };

  const lines = inquiry_raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  const model_candidate = takeModelCandidate(firstLine);

  const result: ParsedInquiry = {
    inquiry_raw,
    model_candidate,
    symptom: "",
    usage_years_note: "",
    contact_datetime_note: "",
    preferred_visit_note: "",
    fee_explanation_note: "",
  };

  const rest = lines.slice(1).join("\n");
  const restNorm = normalizeForParse(rest);
  if (!restNorm) return result;

  type K = keyof Omit<ParsedInquiry, "inquiry_raw" | "model_candidate">;
  const filled = new Set<K>();

  for (const { pattern, key } of LABELS) {
    if (filled.has(key)) continue;
    const m = rest.match(pattern);
    if (!m) continue;
    const start = rest.indexOf(m[0]) + m[0].length;
    let end = rest.length;
    for (const next of LABELS) {
      if (next.key === key) continue;
      const nextM = rest.slice(start).match(next.pattern);
      if (nextM) {
        const nextStart = rest.slice(start).indexOf(nextM[0]);
        if (nextStart >= 0) {
          const candidate = start + nextStart;
          if (candidate < end) end = candidate;
        }
      }
    }
    const value = rest.slice(start, end).replace(/\n/g, " ").trim().slice(0, 500);
    (result as Record<K, string>)[key] = value;
    filled.add(key);
  }

  return result;
}
