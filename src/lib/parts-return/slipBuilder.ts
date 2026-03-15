/**
 * 部品伝票 ページ分割ロジック
 * 要件定義 4-4. 部品伝票生成機能
 * - 担当者が変わるたびに改ページ
 * - 同一担当者でも4件ごとに改ページ
 */

import type { SourceRow, PartsSlipItem, PartsSlipPage } from "./types";
import { PARTS_SLIP_ITEMS_PER_PAGE } from "./types";

/**
 * 対象データから部品伝票ページ一覧を生成する。
 * 担当者が変わるたび改ページ、同一担当者でも4件ごとに改ページ。
 */
export function buildPartsSlipPages(rows: SourceRow[]): PartsSlipPage[] {
  const pages: PartsSlipPage[] = [];
  let currentPage: PartsSlipItem[] = [];
  let currentStaff = "";
  let sequenceNo = 0;
  let pageNo = 0;

  for (const row of rows) {
    const staffChanged = currentStaff !== "" && currentStaff !== row.staffName;

    if (staffChanged || currentPage.length >= PARTS_SLIP_ITEMS_PER_PAGE) {
      if (currentPage.length > 0) {
        pageNo += 1;
        pages.push({ pageNo, staffName: currentStaff, items: currentPage });
        currentPage = [];
      }
    }

    currentStaff = row.staffName;
    sequenceNo += 1;
    currentPage.push({
      sequenceNo,
      partName: row.partName,
      partNumber: row.partNumber,
      quantity: row.quantity,
      orderNo: row.orderNo,
      receptionNo: row.receptionNo,
      completedAt: row.completedAt,
      staffName: row.staffName,
      repairSlipNo: row.repairSlipNo ?? "",
    });
  }

  if (currentPage.length > 0) {
    pageNo += 1;
    pages.push({ pageNo, staffName: currentStaff, items: currentPage });
  }

  return pages;
}
