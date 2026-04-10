/**
 * 項目ごとのOCR結果補正ルール
 * 固定欄はルール優先、自由記述は整形のみ
 */

import type { ConfidenceLevel, FieldType } from "./extractFields-types";

function normalizeNum(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 電話・FAX: 数字とハイフン以外除去、0X-XXXX-XXXX 形式に寄せる */
function postprocessPhone(raw: string): { text: string; confidence: number } {
  const digits = normalizeNum(raw).replace(/\D/g, "");
  if (digits.length < 9) return { text: raw.trim(), confidence: 0.4 };
  const head = digits.slice(0, 2);
  const mid = digits.slice(2, -4);
  const tail = digits.slice(-4);
  const formatted = head.length && mid.length && tail.length ? `${head}-${mid}-${tail}` : raw.trim();
  const ok = /^0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}$/.test(formatted.replace(/\s/g, ""));
  return { text: formatted.trim().slice(0, 20), confidence: ok ? 0.95 : 0.7 };
}

/** 郵便番号: 7桁に正規化、123-4567 形式 */
function postprocessPostalCode(raw: string): { text: string; confidence: number } {
  const seven = normalizeNum(raw).replace(/\D/g, "").slice(0, 7);
  if (seven.length !== 7) return { text: raw.trim().slice(0, 10), confidence: 0.5 };
  const formatted = `${seven.slice(0, 3)}-${seven.slice(3)}`;
  return { text: formatted, confidence: 0.95 };
}

/** 型式: 英数字・ハイフン中心、前後のゴミ除去 */
function postprocessModel(raw: string): { text: string; confidence: number } {
  const t = raw.replace(/\s+/g, " ").trim();
  const cleaned = t.replace(/[^\w\u3040-\u30ff\u4e00-\u9fa5\-－−ー]/gi, "").slice(0, 40);
  const looksLikeModel = /^[A-Za-z0-9\-－−]+$/.test(cleaned) || /^[A-Za-z0-9\-－−].*[A-Za-z0-9]$/.test(cleaned);
  return { text: cleaned || t.slice(0, 40), confidence: looksLikeModel ? 0.9 : 0.6 };
}

/** ガス種: 都市ガス / LP / その他 に寄せる */
function postprocessGasType(raw: string): { text: string; confidence: number } {
  const t = raw.trim().toLowerCase().slice(0, 20);
  if (/都市|ちし|toshi/.test(t)) return { text: "都市ガス", confidence: 0.95 };
  if (/lp|エルピー|プロパン/.test(t)) return { text: "LP", confidence: 0.95 };
  if (/天然|てんねん/.test(t)) return { text: "都市ガス", confidence: 0.9 };
  return { text: raw.trim().slice(0, 20), confidence: t.length > 0 ? 0.7 : 0.3 };
}

/** 日付: YYYY/MM/DD または YYYY-MM-DD に寄せる */
function postprocessDate(raw: string): { text: string; confidence: number } {
  const n = normalizeNum(raw);
  const m = n.match(/(\d{4})[\/\-年]?(\d{1,2})[\/\-月]?(\d{1,2})/);
  if (m) return { text: `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`, confidence: 0.9 };
  const m2 = n.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (m2) return { text: `${m2[1].padStart(2, "0")}/${m2[2].padStart(2, "0")}`, confidence: 0.7 };
  return { text: raw.trim().slice(0, 12), confidence: 0.5 };
}

/** 時間: HH:MM や HH-MM に寄せる */
function postprocessTime(raw: string): { text: string; confidence: number } {
  const n = normalizeNum(raw);
  const m = n.match(/(\d{1,2})[:\-時](\d{2})/);
  if (m) return { text: `${m[1].padStart(2, "0")}:${m[2]}`, confidence: 0.9 };
  return { text: raw.trim().slice(0, 10), confidence: 0.6 };
}

/** 住所: 前後のラベル除去、連続スペース圧縮 */
function postprocessAddress(raw: string): { text: string; confidence: number } {
  const t = raw
    .replace(/\s+/g, " ")
    .replace(/^(住所|郵便番号|〒)\s*[：:]?\s*/i, "")
    .replace(/\s*[（(]お客様[)）]?\s*$/g, "")
    .trim()
    .slice(0, 200);
  const hasPref = /(北海道|東京都|大阪府|京都府|.+?県)/.test(t);
  return { text: t, confidence: hasPref && t.length >= 5 ? 0.85 : 0.6 };
}

/** 氏名・カナ: 前後の「様」や記号除去 */
function postprocessName(raw: string): { text: string; confidence: number } {
  const t = raw.replace(/\s+/g, " ").replace(/^\s*[：:\s]+|\s*様\s*$/g, "").trim().slice(0, 60);
  return { text: t, confidence: t.length >= 1 ? 0.85 : 0.3 };
}

/** 受付番号: 数字8桁以上を優先 */
function postprocessReceptionNo(raw: string): { text: string; confidence: number } {
  const digits = normalizeNum(raw).replace(/\D/g, "");
  const eight = digits.slice(0, 12);
  const ok = eight.length >= 8;
  return { text: eight || raw.trim().slice(0, 20), confidence: ok ? 0.9 : 0.5 };
}

/** 自由記述: 改行・余分スペース整形のみ */
function postprocessFreeText(raw: string): { text: string; confidence: number } {
  const t = raw
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim()
    .slice(0, 2000);
  return { text: t, confidence: t.length > 0 ? 0.75 : 0.3 };
}

export function postprocessField(
  rawText: string,
  fieldType: FieldType,
  confidenceRule: "strict" | "normal" | "lenient" = "normal"
): { normalizedText: string; confidenceScore: number } {
  const raw = (rawText ?? "").trim();
  let result: { text: string; confidence: number };

  switch (fieldType) {
    case "phone":
      result = postprocessPhone(raw);
      break;
    case "postal_code":
      result = postprocessPostalCode(raw);
      break;
    case "model":
    case "serial_number":
      result = postprocessModel(raw);
      break;
    case "gas_type":
      result = postprocessGasType(raw);
      break;
    case "preferred_date":
    case "reception_date":
      result = postprocessDate(raw);
      break;
    case "preferred_time":
      result = postprocessTime(raw);
      break;
    case "address":
    case "request_address":
      result = postprocessAddress(raw);
      break;
    case "customer_name":
    case "customer_furigana":
    case "request_store":
    case "request_contact":
      result = postprocessName(raw);
      break;
    case "reception_no":
      result = postprocessReceptionNo(raw);
      break;
    case "inquiry":
    case "symptom":
    case "internal_note":
    case "note":
      result = postprocessFreeText(raw);
      break;
    default:
      result = { text: raw.slice(0, 500), confidence: raw.length > 0 ? 0.6 : 0.3 };
  }

  let score = result.confidence;
  if (confidenceRule === "strict") score = Math.min(score, 0.9);
  if (confidenceRule === "lenient") score = Math.min(1, score + 0.1);

  return { normalizedText: result.text, confidenceScore: Math.round(score * 100) / 100 };
}

export function confidenceScoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}
