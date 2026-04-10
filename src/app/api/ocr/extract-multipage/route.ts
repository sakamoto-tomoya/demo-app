/**
 * 複数ページOCR: ページ画像を送り、ページごとにテンプレート判定→抽出→候補をマージして formData を返す
 * 受付登録向け: phase=1 で1次項目のみ先に返し高速化、phase=2 で2次項目を返す。
 * POST body: FormData
 *   - phase: "1" | "2"（省略時は全項目）
 *   - page_0: File（画像）, page_1: File, ...
 * レスポンス: { success: true, formData: OcrResult, candidates?: FieldCandidate[], phase: "1"|"2" }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { OcrTemplate, FieldCandidate } from "@/lib/ocr/extractFields-types";
import { getFieldKeysForPhase, type OcrPhase } from "@/lib/ocr/ocr-phase";
import { detectTemplate } from "@/lib/ocr/detectTemplate";
import { cropPageByTemplate } from "@/lib/ocr/cropPageByTemplate";
import { extractFields } from "@/lib/ocr/extractFields";
import { mergeCandidatesToOcrResult } from "@/lib/ocr/mergeCandidates";
import { parseInquirySemiStructured } from "@/lib/ocr/parseInquiry";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "config", "ocr-templates");
const LOG_PREFIX = "[ocr/extract-multipage]";

function loadTemplate(templateId: string): OcrTemplate | null {
  if (templateId === "unknown_template") {
    return loadTemplate("template_without_requester");
  }
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

  const phaseRaw = formData.get("phase");
  const phase: OcrPhase | null =
    phaseRaw === "1" || phaseRaw === "2" ? phaseRaw : null;
  const fieldKeysFilter = phase ? getFieldKeysForPhase(phase) : null;

  const pageBuffers: Buffer[] = [];
  const pageKeys = [...formData.keys()].filter((k) => /^page_\d+$/.test(k)).sort(
    (a, b) => Number(a.replace("page_", "")) - Number(b.replace("page_", ""))
  );
  for (const key of pageKeys) {
    const value = formData.get(key);
    if (value instanceof Blob && (value.type.startsWith("image/") || value.type === "application/octet-stream")) {
      const ab = await value.arrayBuffer();
      pageBuffers.push(Buffer.from(ab));
    }
  }

  if (pageBuffers.length === 0) {
    return NextResponse.json(
      { success: false, error: "ページ画像がありません。page_0, page_1, ... で送ってください。" },
      { status: 400 }
    );
  }

  const allCandidates: FieldCandidate[] = [];
  const startMs = Date.now();
  console.log(`${LOG_PREFIX} 開始 phase=${phase ?? "all"} pages=${pageBuffers.length}`);

  try {
    for (let pageIndex = 0; pageIndex < pageBuffers.length; pageIndex++) {
      const pageBuffer = pageBuffers[pageIndex];
      const templateId = await detectTemplate(pageBuffer);
      let template = loadTemplate(templateId);
      if (!template) continue;

      if (fieldKeysFilter) {
        template = {
          ...template,
          fields: template.fields.filter((f) => fieldKeysFilter.includes(f.field_key)),
        };
        if (template.fields.length === 0) continue;
      }

      const crops = await cropPageByTemplate(pageBuffer, template);
      const extracted = await extractFields(template, crops);

      for (const e of extracted) {
        allCandidates.push({
          pageIndex,
          template: templateId,
          key: e.key,
          rawText: e.rawText,
          normalizedText: e.normalizedText,
          confidence: e.confidence,
          confidenceScore: e.confidenceScore,
          needsReview: e.needsReview,
        });
      }
    }

    let formDataOut = mergeCandidatesToOcrResult(allCandidates);

    const inquiryText = (formDataOut.inquiryContent ?? "").trim();
    if (inquiryText) {
      const parsed = parseInquirySemiStructured(inquiryText);
      formDataOut = {
        ...formDataOut,
        inquiry_raw: parsed.inquiry_raw,
        model_candidate: parsed.model_candidate,
        symptom: parsed.symptom,
        usage_years_note: parsed.usage_years_note,
        contact_datetime_note: parsed.contact_datetime_note,
        preferred_visit_note: parsed.preferred_visit_note,
        fee_explanation_note: parsed.fee_explanation_note,
      };
      if (!(formDataOut.modelName ?? "").trim() && parsed.model_candidate) {
        formDataOut = { ...formDataOut, modelName: parsed.model_candidate, reportedModelName: formDataOut.reportedModelName || parsed.model_candidate };
      }
      if (!(formDataOut.reportedModelName ?? "").trim() && parsed.model_candidate) {
        formDataOut = { ...formDataOut, reportedModelName: parsed.model_candidate };
      }
    }

    const durationMs = Date.now() - startMs;
    console.log(`${LOG_PREFIX} 終了 成功 ${durationMs}ms`);
    return NextResponse.json({
      success: true,
      formData: formDataOut,
      candidates: allCandidates,
      phase: phase ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`${LOG_PREFIX} 失敗 ${durationMs}ms:`, msg);
    return NextResponse.json(
      { success: false, error: `OCR処理に失敗しました: ${msg}` },
      { status: 500 }
    );
  }
}
