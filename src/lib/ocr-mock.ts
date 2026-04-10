/**
 * Document AI の Mock 用データ読み込み（ポートフォリオ・Billing 未設定時用）
 * サーバー（API ルート）からのみ使用。data/ocr-mock/ の JSON を返す。
 *
 * 使い方:
 * - sample.documentai.json … Document AI が返すような text と parsed（項目ごとの値）
 * - sample.mapping.json … 項目ごとの信頼度（confidence）と座標（bbox: page, x, y, w, h）
 * この2つが揃っているときだけ Mock データとして返す。
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import type { OcrResult } from "./ocr-parse";
import type { OcrFieldMapping } from "./ocr-types";
export type { OcrFieldMapping } from "./ocr-types";

/** sample.documentai.json の形 */
type SampleDocumentAi = {
  text: string;
  parsed: OcrResult;
};

const MOCK_DIR = path.join(process.cwd(), "data", "ocr-mock");
const SAMPLE_DOCUMENTAI_PATH = path.join(MOCK_DIR, "sample.documentai.json");
const SAMPLE_MAPPING_PATH = path.join(MOCK_DIR, "sample.mapping.json");

/**
 * Mock 用サンプルデータを読み込む。
 * ファイルがなければ null。呼び出し元で Mock を返すかエラーにするか判断する。
 */
export function loadMockOcrData(): {
  text: string;
  parsed: OcrResult;
  mapping: OcrFieldMapping;
} | null {
  if (typeof window !== "undefined") return null;
  try {
    if (!existsSync(SAMPLE_DOCUMENTAI_PATH) || !existsSync(SAMPLE_MAPPING_PATH)) {
      return null;
    }
    const documentaiRaw = readFileSync(SAMPLE_DOCUMENTAI_PATH, "utf-8");
    const mappingRaw = readFileSync(SAMPLE_MAPPING_PATH, "utf-8");
    const documentai = JSON.parse(documentaiRaw) as SampleDocumentAi;
    const mapping = JSON.parse(mappingRaw) as OcrFieldMapping;
    if (!documentai?.parsed || typeof documentai.text !== "string") return null;
    return {
      text: documentai.text,
      parsed: documentai.parsed,
      mapping: mapping || {},
    };
  } catch {
    return null;
  }
}
