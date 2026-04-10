/**
 * 座標ベースOCR: 項目ごとの画像を受け取り、OCR＋補正して返す
 * POST body: FormData
 *   - templateId: string（例: paloma-default）
 *   - [field_key]: File（画像）… 各項目の切り出し画像を field_key をキーに送る
 * レスポンス: { success: true, fields: ExtractedField[], formData: OcrResult }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { OcrTemplate } from "@/lib/ocr/extractFields-types";
import { extractFields, extractedFieldsToOcrResult } from "@/lib/ocr/extractFields";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "config", "ocr-templates");
const LOG_PREFIX = "[ocr/extract-fields]";

function loadTemplate(templateId: string): OcrTemplate | null {
  const p = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf-8");
  return JSON.parse(raw) as OcrTemplate;
}

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  if (isDemoMode) {
    return NextResponse.json(
      { success: false, error: "デモモードではOCRを利用できません。" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "FormData の解析に失敗しました。" },
      { status: 400 }
    );
  }

  const templateId = formData.get("templateId");
  if (typeof templateId !== "string" || !templateId) {
    return NextResponse.json(
      { success: false, error: "templateId が必要です。" },
      { status: 400 }
    );
  }

  const template = loadTemplate(templateId);
  if (!template) {
    return NextResponse.json(
      { success: false, error: `テンプレートが見つかりません: ${templateId}` },
      { status: 400 }
    );
  }

  const images: { key: string; buffer: Buffer }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "templateId") continue;
    if (value instanceof Blob && value.type.startsWith("image/")) {
      const ab = await value.arrayBuffer();
      images.push({ key, buffer: Buffer.from(ab) });
    }
  }

  if (images.length === 0) {
    return NextResponse.json(
      { success: false, error: "画像が1枚以上必要です。各項目の切り出し画像を field_key で送ってください。" },
      { status: 400 }
    );
  }

  const startMs = Date.now();
  console.log(`${LOG_PREFIX} start templateId=${templateId} images=${images.length}`);

  try {
    const imageKeys = new Set(images.map((i) => i.key));
    const fieldsToProcess = template.fields.filter((f) => imageKeys.has(f.field_key));
    if (fieldsToProcess.length === 0) {
      const durationMs = Date.now() - startMs;
      console.log(`${LOG_PREFIX} success (no fields to process) ${durationMs}ms`);
      return NextResponse.json({
        success: true,
        fields: [],
        formData: extractedFieldsToOcrResult([]),
      });
    }

    const fields = await extractFields({ ...template, fields: fieldsToProcess }, images);

    const mergeStart = Date.now();
    const formDataOut = extractedFieldsToOcrResult(fields);
    const mergeMs = Date.now() - mergeStart;
    console.log(`${LOG_PREFIX} merge start`);
    console.log(`${LOG_PREFIX} merge end ${mergeMs}ms`);

    const durationMs = Date.now() - startMs;
    console.log(`${LOG_PREFIX} success ${durationMs}ms`);
    return NextResponse.json({
      success: true,
      fields,
      formData: formDataOut,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`${LOG_PREFIX} error ${durationMs}ms:`, msg);
    return NextResponse.json(
      { success: false, error: `OCR処理に失敗しました: ${msg}` },
      { status: 500 }
    );
  }
}
