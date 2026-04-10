/**
 * 座標ベースOCR: テンプレート＋画像群から項目ごとに抽出・補正・信頼度付与
 * サーバー（APIルート）からのみ利用（Tesseract は Node で実行）
 */

import type { OcrResult } from "@/lib/ocr-parse";
import type { ExtractedField, OcrTemplate, TemplateFieldDef } from "./extractFields-types";
import { postprocessField, confidenceScoreToLevel } from "./postprocessField";

/** 最小サイズ未満の画像はOCRスキップ（ノイズ防止・高速化） */
const MIN_IMAGE_BYTES = 200;

/** 画像バッファに対して Tesseract でOCR（jpn+eng） */
export async function runOcrOnBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length < MIN_IMAGE_BYTES) return "";
  const Tesseract = (await import("tesseract.js")).default;
  const { data } = await Tesseract.recognize(buffer, "jpn+eng", { logger: () => {} });
  return (data?.text ?? "").trim();
}

/** 並列数上限（同時OCRでメモリ・CPUを抑える） */
const OCR_CONCURRENCY = 4;

const LOG_PREFIX = "[ocr/extract-fields]";

/** 1テンプレート ＋ 項目別画像 から ExtractedField[] を生成（並列OCRで短縮） */
export async function extractFields(
  template: OcrTemplate,
  images: { key: string; buffer: Buffer }[]
): Promise<ExtractedField[]> {
  const byKey = new Map(images.map((i) => [i.key, i.buffer]));

  const runOne = async (def: TemplateFieldDef): Promise<ExtractedField> => {
    const buffer = byKey.get(def.field_key);
    const fieldStart = Date.now();
    if (buffer) {
      console.log(`${LOG_PREFIX} per-field OCR start ${def.field_key}`);
    }
    const rawText = buffer ? await runOcrOnBuffer(buffer) : "";
    const fieldMs = Date.now() - fieldStart;
    if (buffer) {
      console.log(`${LOG_PREFIX} per-field OCR end ${def.field_key} ${fieldMs}ms`);
    }
    const { normalizedText, confidenceScore } = postprocessField(
      rawText,
      def.field_type,
      def.confidence_rule ?? "normal"
    );
    const confidence = confidenceScoreToLevel(confidenceScore);
    const needsReview = confidence === "low" || (Boolean(def.required) && confidence === "medium");
    return {
      key: def.field_key,
      label: def.label,
      rawText,
      normalizedText,
      confidence,
      confidenceScore,
      needsReview,
      sourcePage: def.page,
    };
  };

  const items = template.fields;
  const ocrStart = Date.now();
  console.log(`${LOG_PREFIX} OCR start (${items.length} fields)`);

  const results: ExtractedField[] = [];
  for (let i = 0; i < items.length; i += OCR_CONCURRENCY) {
    const chunk = items.slice(i, i + OCR_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(runOne));
    results.push(...chunkResults);
  }

  const ocrMs = Date.now() - ocrStart;
  console.log(`${LOG_PREFIX} OCR end ${ocrMs}ms`);

  return results;
}

/** OcrResult の全キー（extractFields で未設定の項目は空文字のまま） */
const OCR_RESULT_KEYS: (keyof OcrResult)[] = [
  "receptionNo", "requestStoreName", "requestStoreFurigana", "requestContactName",
  "requestPhone", "requestFax", "requestPhoneFax", "requestAddress", "requestPostalCode",
  "receptionDate", "desiredVisitDate", "desiredVisitTime", "warranty", "paymentMethod", "inputBy",
  "customerName", "customerFurigana", "postalCode", "address", "phone", "mobile",
  "storeNo", "storeType", "modelName", "modelCode", "reportedModelName", "nameplateNo", "gasType",
  "inquiryContent", "internalContact", "memo",
];

/** ExtractedField[] を既存フォーム用 OcrResult に変換 */
export function extractedFieldsToOcrResult(fields: ExtractedField[]): OcrResult {
  const result = {} as OcrResult;
  for (const k of OCR_RESULT_KEYS) {
    result[k] = "";
  }
  for (const f of fields) {
    if (f.key in result) {
      (result as unknown as Record<string, string>)[f.key] = f.normalizedText;
    }
  }
  return result;
}
