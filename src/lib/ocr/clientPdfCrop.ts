"use client";

/**
 * クライアント側: PDF 1ページ目をキャンバスに描画し、テンプレート座標で切り出して Blob の配列を返す
 */

import * as pdfjsLib from "pdfjs-dist";
import type { OcrTemplate } from "./extractFields-types";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/** 描画時の最大幅（これ以上は縮小してOCR負荷を下げる） */
const MAX_CANVAS_WIDTH = 1200;

/** PDF 1ページ目を canvas に描画（最大幅制限で軽量化） */
export async function renderPdfFirstPageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = 2;
  let viewport = page.getViewport({ scale });
  if (viewport.width > MAX_CANVAS_WIDTH) {
    const s = MAX_CANVAS_WIDTH / viewport.width;
    viewport = page.getViewport({ scale: scale * s });
  }
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
  return canvas;
}

/** 正規化座標 (0〜1) で canvas を切り出して Blob を返す（左上原点） */
export function cropCanvasToBlob(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Blob> {
  const w = canvas.width;
  const h = canvas.height;
  const px = Math.round(x * w);
  const py = Math.round(y * h);
  const pw = Math.max(1, Math.round(width * w));
  const ph = Math.max(1, Math.round(height * h));
  const off = document.createElement("canvas");
  off.width = pw;
  off.height = ph;
  const ctx = off.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2d not available"));
  ctx.drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);
  return new Promise((resolve, reject) => {
    off.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.88
    );
  });
}

/** テンプレートを取得 */
export async function fetchTemplate(templateId: string): Promise<OcrTemplate> {
  const res = await fetch(`/api/ocr/template?id=${encodeURIComponent(templateId)}`);
  if (!res.ok) throw new Error("テンプレートの取得に失敗しました");
  return res.json();
}

const LOG_PREFIX = "[clientPdfCrop]";

/** PDF とテンプレートから各項目の画像 Blob を生成（並列で切り出し） */
export async function getTemplateCrops(
  file: File,
  template: OcrTemplate
): Promise<{ key: string; blob: Blob }[]> {
  const pageRenderStart = Date.now();
  if (typeof console !== "undefined" && console.log) {
    console.log(`${LOG_PREFIX} page render start`);
  }
  const canvas = await renderPdfFirstPageToCanvas(file);
  const pageRenderMs = Date.now() - pageRenderStart;
  if (typeof console !== "undefined" && console.log) {
    console.log(`${LOG_PREFIX} page render end ${pageRenderMs}ms`);
  }

  const page1Fields = template.fields.filter((f) => f.page === 1);
  const cropStart = Date.now();
  if (typeof console !== "undefined" && console.log) {
    console.log(`${LOG_PREFIX} crop start (${page1Fields.length} fields)`);
  }
  const blobs = await Promise.all(
    page1Fields.map((field) =>
      cropCanvasToBlob(canvas, field.x, field.y, field.width, field.height).then((blob) => ({
        key: field.field_key,
        blob,
      }))
    )
  );
  const cropMs = Date.now() - cropStart;
  if (typeof console !== "undefined" && console.log) {
    console.log(`${LOG_PREFIX} crop end ${cropMs}ms`);
  }
  return blobs;
}

/** PDF の総ページ数を返す */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

/** 指定ページを canvas に描画（最大幅制限） */
async function renderPdfPageToCanvas(file: File, pageNum: number): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const scale = 2;
  let viewport = page.getViewport({ scale });
  if (viewport.width > MAX_CANVAS_WIDTH) {
    const s = MAX_CANVAS_WIDTH / viewport.width;
    viewport = page.getViewport({ scale: scale * s });
  }
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
  return canvas;
}

/** 指定ページを JPEG Blob で返す（複数ページAPI用） */
export async function renderPdfPageToBlob(file: File, pageNum: number): Promise<Blob> {
  const canvas = await renderPdfPageToCanvas(file, pageNum);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.88
    );
  });
}

/** 全ページを Blob 配列で返す（page_0, page_1, ... 用） */
export async function getMultipageBlobs(file: File): Promise<Blob[]> {
  const numPages = await getPdfPageCount(file);
  const blobs: Blob[] = [];
  for (let i = 1; i <= numPages; i++) {
    blobs.push(await renderPdfPageToBlob(file, i));
  }
  return blobs;
}
