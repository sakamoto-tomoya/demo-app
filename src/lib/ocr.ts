"use client";

// PDF.js が使う Map.prototype.getOrInsertComputed を未対応ブラウザで使えるようにする
import applyMapGetOrInsertComputed from "map.prototype.getorinsertcomputed/shim";
if (typeof window !== "undefined") {
  applyMapGetOrInsertComputed();
}

import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

import { parseOcrText, type OcrResult } from "./ocr-parse";
import type { OcrFieldMapping } from "./ocr-types";
export type { OcrResult } from "./ocr-parse";
export type { OcrFieldMapping } from "./ocr-types";

/** OCR 実行結果。Mock の場合は mapping で信頼度・座標を表示できる */
export type RunPdfOcrResult = {
  parsed: OcrResult;
  mock?: boolean;
  mapping?: OcrFieldMapping;
};

/** PDFの1ページ目から埋め込みテキストを抽出（テキスト付きPDF用） */
async function getTextFromPdfPage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items as { str: string; transform?: number[] }[];
  if (!items?.length) return "";

  // 位置でソート（上→下、左→右）。PDF座標は左下原点のため y は大きいほど上
  const withPos = items
    .filter((it) => it.str != null && String(it.str).trim() !== "")
    .map((it) => {
      const t = it.transform ?? [1, 0, 0, 1, 0, 0];
      return { str: String(it.str), x: t[4], y: t[5] };
    });

  withPos.sort((a, b) => {
    const lineA = Math.round(a.y * 2) / 2;
    const lineB = Math.round(b.y * 2) / 2;
    if (lineB !== lineA) return lineB - lineA;
    return a.x - b.x;
  });

  // 同じ行（y が近い）をまとめる。行の閾値はフォントサイズ程度
  const lines: string[] = [];
  let lastY: number | null = null;
  let line: string[] = [];
  const yTolerance = 1.5;

  for (const it of withPos) {
    const y = it.y;
    if (lastY != null && Math.abs(y - lastY) > yTolerance && line.length) {
      lines.push(line.join("").trim());
      line = [];
    }
    lastY = y;
    line.push(it.str);
  }
  if (line.length) lines.push(line.join("").trim());
  return lines.join("\n");
}

/** PDFの1ページ目を画像として描画し、そのDataURLを返す（OCR用） */
async function pdfFirstPageToImageDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");
  const renderTask = page.render({
    canvasContext: ctx,
    canvas,
    viewport,
    intent: "display",
  });
  await renderTask.promise;
  return canvas.toDataURL("image/png");
}

/** クラウド OCR API 呼び出しのタイムアウト（ミリ秒） */
const OCR_API_TIMEOUT_MS = 95_000;

const LOG_PREFIX = "[runPdfOcr]";

export type RunPdfOcrOptions = {
  /** フォールバック（埋め込みテキスト/Tesseract）に移る直前に呼ばれる（UIの段階表示用） */
  onFallback?: () => void;
};

/** PDFファイルからテキストを取得して転記用オブジェクトを返す（Azure Document Intelligence 成功時はAPI、失敗時は実PDFの埋め込みテキスト/Tesseract にフォールバック） */
export async function runPdfOcr(file: File, options?: RunPdfOcrOptions): Promise<RunPdfOcrResult> {
  const totalStart = Date.now();
  const onFallback = options?.onFallback;

  // 1. API 呼び出し（Azure Document Intelligence）。失敗・未設定・タイムアウト時は下の実PDF解析にフォールバック
  try {
    console.log(`${LOG_PREFIX} Azure OCR 開始`);
    const apiStart = Date.now();
    const formData = new FormData();
    formData.append("file", file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_API_TIMEOUT_MS);
    const res = await fetch("/api/ocr", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = (await res.json()) as {
      success: boolean;
      parsed?: OcrResult;
      error?: string;
      mock?: boolean;
      mapping?: OcrFieldMapping;
    };
    const apiMs = Date.now() - apiStart;
    if (data.success && data.parsed) {
      console.log(`${LOG_PREFIX} Azure OCR 終了 成功 ${apiMs}ms`);
      return {
        parsed: data.parsed,
        mock: data.mock ?? false,
        mapping: data.mapping,
      };
    }
    console.log(`${LOG_PREFIX} Azure OCR 失敗/未設定 ${apiMs}ms、フォールバックへ`);
  } catch (err) {
    const apiMs = Date.now() - totalStart;
    console.log(`${LOG_PREFIX} Azure OCR 例外 ${apiMs}ms:`, err instanceof Error ? err.message : String(err));
  }

  // 2. 埋め込みテキスト（テキスト付きPDF用）または Tesseract（画像PDF用）— 常に選択したPDFの実データ
  onFallback?.();
  console.log(`${LOG_PREFIX} フォールバック（埋め込みテキスト/Tesseract）開始`);
  const fallbackStart = Date.now();
  let text = await getTextFromPdfPage(file);
  const minEmbeddedLength = 150;

  if (text.length < minEmbeddedLength) {
    const dataUrl = await pdfFirstPageToImageDataUrl(file);
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(dataUrl, "jpn+eng", { logger: () => {} });
    text = data.text;
  }

  const parsed = parseOcrText(text);
  const mapping = buildMappingFromParsed(parsed);
  const fallbackMs = Date.now() - fallbackStart;
  const totalMs = Date.now() - totalStart;
  console.log(`${LOG_PREFIX} フォールバック 終了 ${fallbackMs}ms (合計 ${totalMs}ms)`);
  return { parsed, mapping };
}

/** クライアント側解析結果から抽出結果パネル用の mapping を組み立て（信頼度・座標はダミー） */
function buildMappingFromParsed(parsed: OcrResult): OcrFieldMapping {
  const entries = Object.entries(parsed).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );
  const dummyBbox = { page: 1, x: 0, y: 0, w: 0, h: 0 };
  return Object.fromEntries(
    entries.map(([k, v]) => [
      k,
      { value: String(v), confidence: 1, bbox: dummyBbox },
    ])
  ) as OcrFieldMapping;
}
