/**
 * data/ocr-reference/ の CSV を読み、OCR のラベル・終端ルールを返す。
 * - field-definitions.csv: Excel 形式（pdf_label, web_target, page, x, y）→ 順序で終端を推定
 * - field-labels.csv: 簡易形式（field, labels, next_labels）
 * サーバー（API ルート）からのみ利用可能。
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

export type OcrReferenceRow = {
  field: string;
  labels: string[];
  next_labels: string[];
};

const REF_DIR = path.join(process.cwd(), "data", "ocr-reference");
const FIELD_DEF_PATH = path.join(REF_DIR, "field-definitions.csv");
const FIELD_LABELS_PATH = path.join(REF_DIR, "field-labels.csv");

/** Excel の web_target（camelCase）→ OcrResult のキー */
const WEB_TARGET_TO_OCR_KEY: Record<string, string> = {
  repairReceptionNo: "receptionNo",
  acceptedAt: "receptionDate",
  visitPreferredDate: "desiredVisitDate",
  visitPreferredTime: "desiredVisitTime",
  warranty: "warranty",
  paymentMethod: "paymentMethod",
  customerName: "customerName",
  customerFurigana: "customerFurigana",
  postalCode: "postalCode",
  address: "address",
  homePhone: "phone",
  mobilePhone: "mobile",
  modelName: "modelName",
  declaredModelName: "reportedModelName",
  gasType: "gasType",
  inquiryDetail: "inquiryContent",
  internalNote: "internalContact",
  requesterName: "requestStoreName",
  requesterFurigana: "requestStoreFurigana",
  requesterContactName: "requestContactName",
  requesterPhone: "requestPhone",
  requesterFax: "requestFax",
  requesterAddress: "requestAddress",
};

/**
 * CSV を1行ずつパース（改行は行区切り、カンマは列区切り）。
 * ダブルクォート内のカンマは区切りとみなさない。
 */
function parseCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((s) => s.trim().length > 0);
  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        cells.push(cell.trim().replace(/^"|"$/g, ""));
        cell = "";
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim().replace(/^"|"$/g, ""));
    rows.push(cells);
  }
  return rows;
}

/**
 * field-definitions.csv（Excel 形式）を読み、pdf_label と順序から OcrReferenceRow を生成。
 * 行は page, y, x でソートし、次の行の pdf_label を終端ラベルとして使う。
 */
function loadFieldDefinitions(): OcrReferenceRow[] | null {
  try {
    if (!existsSync(FIELD_DEF_PATH)) return null;
    const raw = readFileSync(FIELD_DEF_PATH, "utf-8");
    const rows = parseCsv(raw);
    if (rows.length < 2) return null;
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const pdfLabelIdx = header.findIndex((h) => h === "pdf_label" || h === "pdflabel");
    const webTargetIdx = header.findIndex((h) => h === "web_target" || h === "webtarget");
    const pageIdx = header.findIndex((h) => h === "page");
    const yIdx = header.findIndex((h) => h === "y");
    const xIdx = header.findIndex((h) => h === "x");
    if (pdfLabelIdx === -1 || webTargetIdx === -1) return null;
    const data: { pdf_label: string; web_target: string; page: number; y: number; x: number }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const pdf_label = (row[pdfLabelIdx] ?? "").trim();
      const web_target = (row[webTargetIdx] ?? "").trim();
      if (!pdf_label || !web_target) continue;
      const ocrKey = WEB_TARGET_TO_OCR_KEY[web_target] ?? web_target;
      const page = pageIdx >= 0 ? parseInt(String(row[pageIdx] ?? 0), 10) || 1 : 1;
      const y = yIdx >= 0 ? parseInt(String(row[yIdx] ?? 0), 10) || 0 : 0;
      const x = xIdx >= 0 ? parseInt(String(row[xIdx] ?? 0), 10) || 0 : 0;
      data.push({ pdf_label, web_target: ocrKey, page, y, x });
    }
    if (data.length === 0) return null;
    // ファイル（Excel）の行順を保持し、次の行の pdf_label を終端ラベルにする
    const result: OcrReferenceRow[] = [];
    for (let i = 0; i < data.length; i++) {
      const curr = data[i];
      const nextLabels: string[] = [];
      if (i + 1 < data.length && data[i + 1].pdf_label !== curr.pdf_label) {
        nextLabels.push(data[i + 1].pdf_label);
      }
      result.push({
        field: curr.web_target,
        labels: [curr.pdf_label],
        next_labels: nextLabels,
      });
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * field-labels.csv（簡易形式）を読み、参照ルールの配列を返す。
 */
function loadFieldLabels(): OcrReferenceRow[] | null {
  try {
    if (!existsSync(FIELD_LABELS_PATH)) return null;
    const raw = readFileSync(FIELD_LABELS_PATH, "utf-8");
    const rows = parseCsv(raw);
    if (rows.length < 2) return null;
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const fieldIdx = header.indexOf("field");
    const labelsIdx = header.indexOf("labels");
    const nextIdx = header.indexOf("next_labels");
    if (fieldIdx === -1 || labelsIdx === -1 || nextIdx === -1) return null;
    const result: OcrReferenceRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const field = (row[fieldIdx] ?? "").trim();
      const labelsStr = (row[labelsIdx] ?? "").trim();
      const nextStr = (row[nextIdx] ?? "").trim();
      if (!field) continue;
      result.push({
        field,
        labels: labelsStr ? labelsStr.split("|").map((s) => s.trim()).filter(Boolean) : [],
        next_labels: nextStr ? nextStr.split("|").map((s) => s.trim()).filter(Boolean) : [],
      });
    }
    return result.length ? result : null;
  } catch {
    return null;
  }
}

/**
 * data/ocr-reference/ の CSV を読み、参照ルールの配列を返す。
 * field-definitions.csv（Excel 形式）を優先し、なければ field-labels.csv を使用。
 */
export function loadOcrReference(): OcrReferenceRow[] | null {
  if (typeof window !== "undefined") return null;
  const fromDef = loadFieldDefinitions();
  if (fromDef && fromDef.length > 0) return fromDef;
  return loadFieldLabels();
}
