/**
 * 受付新規登録専用 OCR API（カスタムモデル paloma-repair-model のみ）
 * PDF 1ファイルを送信し、カスタムモデルで抽出した結果をフォーム用 OcrResult で返す
 */
import { NextRequest, NextResponse } from "next/server";
import type { OcrResult } from "@/lib/ocr-parse";
import { analyzeWithCustomModel, isAzureDocumentIntelligenceConfigured, mapExtractResultToOcrResult } from "@/lib/ocr/providers/azureDocumentIntelligence";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const LOG_PREFIX = "[api/ocr/intake-primary]";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type IntakePrimaryResponse =
  | { success: true; formData: OcrResult; status: "success" }
  | { success: false; error: string; status: "error"; formData?: OcrResult };

export async function POST(request: NextRequest): Promise<NextResponse<IntakePrimaryResponse>> {
  console.log(`${LOG_PREFIX} リクエスト受付（カスタムモデル）`);

  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr as NextResponse<IntakePrimaryResponse>;
  const rate = checkRateLimit(request);
  if (rate) return rate as NextResponse<IntakePrimaryResponse>;

  if (isDemoMode) {
    return NextResponse.json(
      { success: false, error: "デモモードではOCRを利用できません。", status: "error" },
      { status: 403 }
    );
  }

  if (!isAzureDocumentIntelligenceConfigured()) {
    return NextResponse.json({
      success: false,
      error:
        "Azure Document Intelligence が未設定です。AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT と AZURE_DOCUMENT_INTELLIGENCE_KEY を設定してください。",
      status: "error",
    });
  }

  let buffer: Buffer;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({
        success: false,
        error: "PDF ファイルを送信してください。formData の key は file にしてください。",
        status: "error",
      });
    }
    const ab = await file.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} ファイル読み取り失敗:`, msg);
    return NextResponse.json({
      success: false,
      error: "ファイルの読み取りに失敗しました。",
      status: "error",
    });
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({
      success: false,
      error: "ファイルは20MB以下にしてください。",
      status: "error",
    });
  }

  const result = await analyzeWithCustomModel(buffer);

  if (!result.success) {
    console.error(`${LOG_PREFIX} 抽出失敗:`, result.error);
    return NextResponse.json({
      success: false,
      error: result.error,
      status: "error",
    });
  }

  const formData = mapExtractResultToOcrResult(result.data);
  console.log(`${LOG_PREFIX} 完了 項目数=${Object.values(result.data).filter((v) => v !== "").length}`);
  return NextResponse.json({
    success: true,
    formData,
    status: "success",
  });
}
