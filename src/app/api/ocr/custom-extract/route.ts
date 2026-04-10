/**
 * カスタムモデル（paloma-repair-model）で PDF から項目を抽出し JSON で返す API
 */
import { NextRequest, NextResponse } from "next/server";
import { analyzeWithCustomModel, isAzureDocumentIntelligenceConfigured } from "@/lib/ocr/providers/azureDocumentIntelligence";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const LOG_PREFIX = "[api/ocr/custom-extract]";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type CustomExtractResponse = {
  request_store_name: string;
  furigana: string;
  contact_name: string;
  phone: string;
  fax: string;
  customer_name: string;
  customer_furigana: string;
  postal_code: string;
  address: string;
  home_phone: string;
  model_name: string;
  gas_type: string;
  reception_date: string;
  preferred_visit_date: string;
  preferred_visit_time: string;
  warranty: string;
  payment_method: string;
  inquiry_content: string;
  repair_history: string;
  internal_note: string;
};

export async function POST(request: NextRequest): Promise<NextResponse<CustomExtractResponse | { error: string }>> {
  console.log(`${LOG_PREFIX} リクエスト受付（カスタムモデル paloma-repair-model）`);

  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr as NextResponse<{ error: string }>;
  const rate = checkRateLimit(request);
  if (rate) return rate as NextResponse<{ error: string }>;

  if (!isAzureDocumentIntelligenceConfigured()) {
    return NextResponse.json(
      {
        error:
          "Azure Document Intelligence が未設定です。AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT と AZURE_DOCUMENT_INTELLIGENCE_KEY を設定してください。",
      },
      { status: 400 }
    );
  }

  let buffer: Buffer;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "PDF または画像ファイルが必要です。multipart/form-data で file を送信してください。" },
        { status: 400 }
      );
    }
    const ab = await file.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} ファイル読み取り失敗:`, msg);
    return NextResponse.json({ error: "ファイルの読み取りに失敗しました。" }, { status: 400 });
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "ファイルは20MB以下にしてください。" }, { status: 400 });
  }

  const result = await analyzeWithCustomModel(buffer);

  if (!result.success) {
    console.error(`${LOG_PREFIX} 抽出失敗:`, result.error);
    return NextResponse.json({ error: result.error }, { status: 200 });
  }

  const d = result.data;
  const response: CustomExtractResponse = {
    request_store_name: d.shop_name,
    furigana: d.shop_kana,
    contact_name: d.shop_manager,
    phone: d.shop_phone,
    fax: d.shop_fax,
    customer_name: d.customer_name,
    customer_furigana: d.customer_kana,
    postal_code: d.customer_zip,
    address: d.customer_address,
    home_phone: d.customer_phone,
    model_name: d.model,
    gas_type: d.gas_type,
    reception_date: d.received_at,
    preferred_visit_date: d.visit_date,
    preferred_visit_time: d.visit_time,
    warranty: d.warranty,
    payment_method: d.payment,
    inquiry_content: d.inquiry,
    repair_history: d.repair_history,
    internal_note: d.internal_note,
  };

  console.log(`${LOG_PREFIX} 抽出完了`);
  return NextResponse.json(response);
}
