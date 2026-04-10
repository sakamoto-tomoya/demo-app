/**
 * OCR 学習データを Turso に保存し、完了案件ナレッジ（Dify）へも登録する。
 * POST: 手修正内容 + 使用部品（単一行・明細 JSON）
 */
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { requireAccessAuth } from "@/lib/access-auth";
import { createDifyKnowledgeDocument } from "@/lib/dify-knowledge-create";
import { buildCompletionDetail, formatCompletionDetailForDify } from "@/lib/completion-detail";
import type { UsedPartRowForDify } from "@/lib/completion-detail";

export type OcrTrainingPostBody = {
  pdf_file_name?: string;
  model?: string;
  model_display?: string;
  gas_type?: string;
  received_at?: string;
  warranty?: string;
  payment?: string;
  symptom_category?: string;
  confirmed_cause?: string;
  solution_summary?: string;
  /** 完了詳細の代表となる使用部品品番 */
  part_number?: string;
  /** 完了詳細の代表となる使用部品名 */
  part_name?: string;
  work_result?: string;
  /** JSON 文字列: getPartsRowsForOutbound と同型の配列 */
  used_parts_json?: string;
};

function parseUsedPartsJson(raw: unknown): UsedPartRowForDify[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((r) => {
      const o = r as { partNo?: string; partName?: string; qty?: number; orderNo?: string };
      return {
        partNo: String(o.partNo ?? ""),
        partName: String(o.partName ?? ""),
        qty: typeof o.qty === "number" && !Number.isNaN(o.qty) ? o.qty : 0,
        orderNo: o.orderNo !== undefined ? String(o.orderNo) : undefined,
      };
    });
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseUsedPartsJson(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;

  let body: OcrTrainingPostBody;
  try {
    body = (await request.json()) as OcrTrainingPostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON の解析に失敗しました。" }, { status: 400 });
  }

  const pdfFileName = (body.pdf_file_name ?? "unknown.pdf").trim() || "unknown.pdf";
  const usedParts = parseUsedPartsJson(body.used_parts_json);
  const usedPartsJsonStr =
    typeof body.used_parts_json === "string" && body.used_parts_json.trim()
      ? body.used_parts_json.trim()
      : JSON.stringify(usedParts);

  const detail = buildCompletionDetail({
    manufacturer: "パロマ",
    category: "",
    model: body.model ?? "",
    inquiry_content: "",
    symptom_category: body.symptom_category ?? "",
    confirmed_cause: body.confirmed_cause ?? "",
    part_number: body.part_number ?? "",
    part_name: body.part_name ?? "",
    work_detail: "",
    work_result: body.work_result ?? "",
    note: "",
    solution_summary: body.solution_summary ?? "",
    is_completed: true,
  });

  const difyText = formatCompletionDetailForDify(detail, { usedParts });
  const baseName = pdfFileName.replace(/\.[^.]+$/, "") || "training";
  const docName = `学習_${baseName}_${new Date().toISOString().slice(0, 10)}`;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT INTO ocr_training_data (
        id, pdf_file_name, model, model_display, gas_type, received_at, warranty, payment,
        part_number, part_name, used_parts_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        pdfFileName,
        body.model ?? null,
        body.model_display ?? null,
        body.gas_type ?? null,
        body.received_at ?? null,
        body.warranty ?? null,
        body.payment ?? null,
        body.part_number ?? null,
        body.part_name ?? null,
        usedPartsJsonStr || null,
        createdAt,
      ],
    });
  } catch (error) {
    console.error("[api/ocr-training-data] Turso INSERT error", error);
    return NextResponse.json(
      { ok: false, error: "学習データの保存に失敗しました。" },
      { status: 500 }
    );
  }

  const dify = await createDifyKnowledgeDocument(difyText, docName, "completion_single_chunk");

  return NextResponse.json({ ok: true, id, dify });
}
