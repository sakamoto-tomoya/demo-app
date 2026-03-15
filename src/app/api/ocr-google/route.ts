import { NextRequest, NextResponse } from "next/server";
import { parseOcrText } from "@/lib/ocr-parse";
import type { OcrResult } from "@/lib/ocr-parse";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

/** 成功時のレスポンス */
export type OcrGoogleSuccessResponse = {
  success: true;
  source: "google-document-ai";
  text: string;
  parsed: OcrResult;
};

/** 失敗時のレスポンス */
export type OcrGoogleErrorResponse = {
  success: false;
  error: string;
};

export type OcrGoogleResponse = OcrGoogleSuccessResponse | OcrGoogleErrorResponse;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
const LOCATION = process.env.DOCUMENT_AI_LOCATION ?? "us";
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID;

export async function POST(request: NextRequest): Promise<NextResponse<OcrGoogleResponse>> {
  const fail = (error: string): NextResponse<OcrGoogleErrorResponse> =>
    NextResponse.json({ success: false, error }, { status: 200 });

  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr as NextResponse<OcrGoogleResponse>;
  const rate = checkRateLimit(request);
  if (rate) return rate as NextResponse<OcrGoogleResponse>;

  if (isDemoMode) {
    return NextResponse.json(
      { success: false, error: "デモモードではOCRを利用できません。" },
      { status: 403 }
    );
  }

  if (!PROJECT_ID || !PROCESSOR_ID) {
    return fail("Google Document AI が未設定です。GOOGLE_CLOUD_PROJECT_ID と DOCUMENT_AI_PROCESSOR_ID を設定してください。");
  }

  let buffer: Buffer;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return fail("PDFファイルが必要です。multipart/form-data で file フィールドを送信してください。");
    }
    const ab = await file.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch {
    return fail("ファイルの読み取りに失敗しました。");
  }

  if (buffer.length > 20 * 1024 * 1024) {
    return fail("PDFは20MB以下にしてください。");
  }

  try {
    const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai").then((m) => m.v1);
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${LOCATION}-documentai.googleapis.com`,
    });
    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer,
        mimeType: "application/pdf",
      },
    });

    const text = result.document?.text ?? "";
    if (!text || text.length < 50) {
      return fail("Document AI からテキストを取得できませんでした。スキャン品質やページ数を確認してください。");
    }

    const parsed = parseOcrText(text);
    return NextResponse.json({
      success: true,
      source: "google-document-ai",
      text,
      parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Document AI の処理に失敗しました。";
    console.error("[ocr-google]", message);
    return fail(message);
  }
}
