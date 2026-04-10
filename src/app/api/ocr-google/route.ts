/**
 * OCR API: Document AI 本番 または Mock（ポートフォリオ用のみ）
 * - DOCUMENT_AI_USE_MOCK=true のときのみ Mock（data/ocr-mock の JSON を返す）
 * - 本番: 環境変数がそろっていれば Google Document AI を呼ぶ
 * - 環境変数不足・Document AI エラー時はエラーを返す（クライアント側で実PDFの埋め込みテキスト/Tesseract にフォールバック）
 */
import { NextRequest, NextResponse } from "next/server";
import { parseOcrText } from "@/lib/ocr-parse";
import type { OcrResult } from "@/lib/ocr-parse";
import type { OcrFieldMapping } from "@/lib/ocr-types";
import { loadMockOcrData } from "@/lib/ocr-mock";
import { loadOcrReference } from "@/lib/ocr-reference";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

/** 成功時のレスポンス（本番: Document AI、Mock: 事前保存JSON） */
export type OcrGoogleSuccessResponse = {
  success: true;
  source: "google-document-ai" | "mock";
  text: string;
  parsed: OcrResult;
  /** Mock 時のみ。項目ごとの信頼度・バウンディングボックス */
  mock?: boolean;
  mapping?: OcrFieldMapping;
};

export type OcrGoogleErrorResponse = {
  success: false;
  error: string;
};

export type OcrGoogleResponse = OcrGoogleSuccessResponse | OcrGoogleErrorResponse;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
const LOCATION = process.env.DOCUMENT_AI_LOCATION ?? "us";
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID;
/** 明示的に Mock を使う（DOCUMENT_AI_USE_MOCK=true で Billing なしでも動作） */
const USE_MOCK = process.env.DOCUMENT_AI_USE_MOCK === "true";

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

  // ----- Mock モード: ポートフォリオ用。環境変数不要・Billing 不要 -----
  if (USE_MOCK) {
    const mockData = loadMockOcrData();
    if (mockData) {
      return NextResponse.json({
        success: true,
        source: "mock",
        text: mockData.text,
        parsed: mockData.parsed,
        mock: true,
        mapping: mockData.mapping,
      });
    }
    return fail("Mock データが見つかりません。data/ocr-mock/sample.documentai.json と sample.mapping.json を配置してください。");
  }

  // ----- 本番: 環境変数が不足している場合はエラー（クライアントで実PDF解析にフォールバック） -----
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

    const reference = loadOcrReference();
    const parsed = parseOcrText(text, reference);
    return NextResponse.json({
      success: true,
      source: "google-document-ai",
      text,
      parsed,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const isCredentialNotFound =
      /ENOENT|does not exist|no such file|credentials|key file/i.test(raw) ||
      (err as NodeJS.ErrnoException)?.code === "ENOENT";
    const message = isCredentialNotFound
      ? "Google Cloud の認証鍵ファイルが見つかりません。.env.local の GOOGLE_APPLICATION_CREDENTIALS を設定してください。"
      : raw || "Document AI の処理に失敗しました。";
    console.error("[ocr-google]", raw);
    return fail(message);
  }
}
