/**
 * OCR API: カスタムモデル（paloma-repair-model）で PDF から項目抽出
 */
import { NextRequest, NextResponse } from "next/server";
import type { OcrResult } from "@/lib/ocr-parse";
import { analyzeWithCustomModel, isAzureDocumentIntelligenceConfigured, mapExtractResultToOcrResult } from "@/lib/ocr/providers/azureDocumentIntelligence";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const LOG_PREFIX = "[api/ocr]";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type OcrApiSuccessResponse = {
  success: true;
  source: "azure-document-intelligence";
  text: string;
  parsed: OcrResult;
};

export type OcrApiErrorResponse = {
  success: false;
  error: string;
};

export type OcrApiResponse = OcrApiSuccessResponse | OcrApiErrorResponse;

function fail(error: string): NextResponse<OcrApiErrorResponse> {
  return NextResponse.json({ success: false, error }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse<OcrApiResponse>> {
  console.log(`${LOG_PREFIX} OCR 開始（カスタムモデル）`);

  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr as NextResponse<OcrApiResponse>;
  const rate = checkRateLimit(request);
  if (rate) return rate as NextResponse<OcrApiResponse>;

  if (isDemoMode) {
    return NextResponse.json(
      { success: false, error: "デモモードではOCRを利用できません。" },
      { status: 403 }
    );
  }

  if (!isAzureDocumentIntelligenceConfigured()) {
    return fail(
      "Azure Document Intelligence が未設定です。AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT と AZURE_DOCUMENT_INTELLIGENCE_KEY を設定してください。"
    );
  }

  let buffer: Buffer;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return fail("PDFまたは画像ファイルが必要です。multipart/form-data で file を送信してください。");
    }
    const ab = await file.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} ファイル読み取り失敗:`, msg);
    return fail("ファイルの読み取りに失敗しました。");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return fail("ファイルは20MB以下にしてください。");
  }

  const result = await analyzeWithCustomModel(buffer);

  if (!result.success) {
    console.error(`${LOG_PREFIX} 抽出失敗:`, result.error);
    return fail(result.error);
  }

  const parsed = mapExtractResultToOcrResult(result.data);
  const text = result.data.inquiry || [result.data.customer_name, result.data.model].filter(Boolean).join(" ");
  console.log(`${LOG_PREFIX} OCR 終了 成功`);
  return NextResponse.json({
    success: true,
    source: "azure-document-intelligence",
    text,
    parsed,
  });
}
