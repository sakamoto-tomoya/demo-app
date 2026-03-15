/**
 * 部品返品伝票・返品シール アプリケーション層
 * データ取得・抽出・検証・帳票生成のユースケース
 */

import type { OutboundRecord } from "@/lib/parts-types";
import type { SourceRow, ValidationError, PartsSlipPage, ReturnLabelPage } from "./types";
import { isTargetBillingType } from "./types";
import { validateSourceRows } from "./validation";
import { buildPartsSlipPages } from "./slipBuilder";
import { buildReturnLabelPages } from "./sealBuilder";

/**
 * OutboundRecord を SourceRow に変換（行番号は1始まり）
 */
function toSourceRow(r: OutboundRecord, index: number): Omit<SourceRow, "rowNo"> & { rowNo: number } {
  return {
    rowNo: index + 1,
    partNumber: r.partNo ?? "",
    completedAt: r.outboundDate ?? "",
    partName: r.partName ?? "",
    quantity: r.outboundQty ?? 0,
    staffName: r.outboundPerson ?? "",
    receptionNo: r.receptionNo ?? "",
    orderNo: r.orderNo ?? "",
    billingType: r.billingType ?? "",
    repairSlipNo: r.repairSlipNo ?? "",
  };
}

/**
 * 出庫一覧から「請求区分＝無償・無償Y・無料」の行を抽出し、出庫担当者昇順でソートした SourceRow を返す。
 * rowNo は元データー（outboundList）での行番号（1始まり）。
 */
export function loadAndFilterSource(outboundList: OutboundRecord[]): SourceRow[] {
  const withRowNo = outboundList.map((r, i) => ({ ...toSourceRow(r, i), rowNo: i + 1 }));
  return withRowNo
    .filter((r) => isTargetBillingType(r.billingType))
    .sort((a, b) => a.staffName.localeCompare(b.staffName));
}

export type PrepareResult =
  | { ok: true; rows: SourceRow[]; errors: [] }
  | { ok: false; rows: []; errors: ValidationError[] };

/**
 * データ取得・抽出・検証まで実行し、プレビュー用の件数やエラーを返す。
 */
export function prepareSourceRows(outboundList: OutboundRecord[]): PrepareResult {
  const rows = loadAndFilterSource(outboundList);
  const errors = validateSourceRows(rows);
  if (errors.length > 0) {
    return { ok: false, rows: [], errors };
  }
  return { ok: true, rows, errors: [] };
}

export type BuildSlipResult = { slipPages: PartsSlipPage[] };
export type BuildLabelResult = { labelPages: ReturnLabelPage[] };

/**
 * 検証済み SourceRow から部品伝票ページを生成する。
 */
export function buildSlipPages(rows: SourceRow[]): BuildSlipResult {
  return { slipPages: buildPartsSlipPages(rows) };
}

/**
 * 検証済み SourceRow から返品シール（返品ラベル）ページを生成する。
 */
export function buildLabelPages(rows: SourceRow[]): BuildLabelResult {
  return { labelPages: buildReturnLabelPages(rows) };
}
