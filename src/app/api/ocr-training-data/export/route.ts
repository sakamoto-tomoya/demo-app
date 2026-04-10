/**
 * OCR 学習データを CSV でエクスポート（Azure Document Intelligence Studio インポート用）
 * GET: 蓄積した手修正データを CSV で返す
 */
import { NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { requireAccessAuth } from "@/lib/access-auth";

/** Studio で使う日本語フィールド名（CSV ヘッダー） */
const CSV_HEADERS = [
  "pdf_file_name",
  "修理受付番号",
  "ご依頼店名",
  "フリガナ",
  "ご担当者名",
  "電話番号",
  "FAX",
  "依頼元郵便番号",
  "依頼元住所",
  "お客様名",
  "お客様フリガナ",
  "郵便番号",
  "住所",
  "自宅電話",
  "携帯番号",
  "型式名",
  "お申し出型式名",
  "ガス種",
  "受付日",
  "訪問希望日",
  "訪問希望時間",
  "保証",
  "支払方法",
  "問合/依頼内容",
  "社内連絡",
  "最新修理履歴",
  "使用部品品番",
  "使用部品名",
  "使用部品明細_json",
];

function escapeCsvCell(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const t = String(s).trim();
  if (t.includes('"') || t.includes(",") || t.includes("\n") || t.includes("\r")) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

export async function GET() {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;

  try {
    const client = getTursoClient();
    const res = await client.execute({
      sql: `SELECT pdf_file_name, reception_no, shop_name, shop_kana, shop_manager, shop_phone, shop_fax,
            shop_zip, shop_address, customer_name, customer_kana, customer_zip, customer_address,
            customer_phone, customer_mobile, model, model_display, gas_type, received_at, visit_date,
            visit_time, warranty, payment, inquiry, internal_note, repair_history,
            part_number, part_name, used_parts_json
            FROM ocr_training_data
            ORDER BY created_at DESC`,
      args: [],
    });

    const rows: string[] = [CSV_HEADERS.join(",")];
    for (const row of res.rows) {
      const r = row as Record<string, string | null | undefined>;
      const cells = [
        escapeCsvCell(r.pdf_file_name),
        escapeCsvCell(r.reception_no),
        escapeCsvCell(r.shop_name),
        escapeCsvCell(r.shop_kana),
        escapeCsvCell(r.shop_manager),
        escapeCsvCell(r.shop_phone),
        escapeCsvCell(r.shop_fax),
        escapeCsvCell(r.shop_zip),
        escapeCsvCell(r.shop_address),
        escapeCsvCell(r.customer_name),
        escapeCsvCell(r.customer_kana),
        escapeCsvCell(r.customer_zip),
        escapeCsvCell(r.customer_address),
        escapeCsvCell(r.customer_phone),
        escapeCsvCell(r.customer_mobile),
        escapeCsvCell(r.model),
        escapeCsvCell(r.model_display),
        escapeCsvCell(r.gas_type),
        escapeCsvCell(r.received_at),
        escapeCsvCell(r.visit_date),
        escapeCsvCell(r.visit_time),
        escapeCsvCell(r.warranty),
        escapeCsvCell(r.payment),
        escapeCsvCell(r.inquiry),
        escapeCsvCell(r.internal_note),
        escapeCsvCell(r.repair_history),
        escapeCsvCell(r.part_number),
        escapeCsvCell(r.part_name),
        escapeCsvCell(r.used_parts_json),
      ];
      rows.push(cells.join(","));
    }

    const csv = "\uFEFF" + rows.join("\r\n"); // BOM for Excel UTF-8
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ocr-training-data-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("[api/ocr-training-data/export] GET error", error);
    return NextResponse.json(
      { error: "CSV のエクスポートに失敗しました。" },
      { status: 500 }
    );
  }
}
