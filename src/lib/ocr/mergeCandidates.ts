/**
 * 全ページの FieldCandidate をマージし、項目ごとの採用値を1つに決めて OcrResult にする
 */

import type { FieldCandidate } from "./extractFields-types";
import type { OcrResult } from "@/lib/ocr-parse";

const OCR_RESULT_KEYS: (keyof OcrResult)[] = [
  "receptionNo", "requestStoreName", "requestStoreFurigana", "requestContactName",
  "requestPhone", "requestFax", "requestPhoneFax", "requestAddress", "requestPostalCode",
  "receptionDate", "desiredVisitDate", "desiredVisitTime", "warranty", "paymentMethod", "inputBy",
  "customerName", "customerFurigana", "postalCode", "address", "phone", "mobile",
  "storeNo", "storeType", "modelName", "modelCode", "reportedModelName", "nameplateNo", "gasType",
  "inquiryContent", "internalContact", "memo",
];

const CONFIDENCE_ORDER = { high: 3, medium: 2, low: 1 } as const;

/**
 * 同一 key の候補のうち、採用する1件を選ぶ
 * 優先: 非空かつ信頼度が高いもの。同信頼度なら先に出てきたページを採用
 */
function pickBest(candidates: FieldCandidate[]): FieldCandidate | null {
  const withValue = candidates.filter((c) => c.normalizedText.trim().length > 0);
  if (withValue.length === 0) return candidates[0] ?? null;
  withValue.sort((a, b) => {
    const scoreA = CONFIDENCE_ORDER[a.confidence];
    const scoreB = CONFIDENCE_ORDER[b.confidence];
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.confidenceScore - b.confidenceScore > 0 ? -1 : 1;
  });
  return withValue[0];
}

/**
 * 全ページの候補をマージし、各 key の採用値だけを持つ OcrResult を返す
 */
export function mergeCandidatesToOcrResult(allCandidates: FieldCandidate[]): OcrResult {
  const result = {} as OcrResult;
  for (const k of OCR_RESULT_KEYS) {
    result[k] = "";
  }

  const byKey = new Map<string, FieldCandidate[]>();
  for (const c of allCandidates) {
    if (!byKey.has(c.key)) byKey.set(c.key, []);
    byKey.get(c.key)!.push(c);
  }

  for (const [key, candidates] of byKey) {
    const best = pickBest(candidates);
    if (best && key in result) {
      (result as unknown as Record<string, string>)[key] = best.normalizedText;
    }
  }

  return result;
}
