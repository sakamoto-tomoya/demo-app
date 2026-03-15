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
export type { OcrResult } from "./ocr-parse";

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

/** PDFファイルからテキストを取得して転記用オブジェクトを返す（Google Document AI 優先 → 埋め込みテキスト → OCR） */
export async function runPdfOcr(file: File): Promise<OcrResult> {
  // 1. Google Document AI を優先利用
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/ocr-google", { method: "POST", body: formData });
    const data = (await res.json()) as { success: boolean; parsed?: OcrResult; error?: string };
    if (data.success && data.parsed) return data.parsed;
  } catch {
    // ネットワークエラー等はローカル処理にフォールバック
  }

  // 2. PDFの埋め込みテキストを取得（テキスト付きPDFなら正確で高速）
  let text = await getTextFromPdfPage(file);
  const minEmbeddedLength = 150;

  if (text.length < minEmbeddedLength) {
    // 3. スキャンPDFなどは Tesseract OCR
    const dataUrl = await pdfFirstPageToImageDataUrl(file);
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(dataUrl, "jpn+eng", { logger: () => {} });
    text = data.text;
  }

  return parseOcrText(text);
}
