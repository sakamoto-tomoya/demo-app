/**
 * 返品シール（返品ラベル）複製・ページ分割ロジック
 * - 出庫数の枚数分だけ同じシールを複製
 * - 8枚で1ページ
 */

import type { SourceRow, ReturnLabelItem, ReturnLabelPage } from "./types";
import { RETURN_LABEL_ITEMS_PER_PAGE } from "./types";

/**
 * 対象データから返品シールを出庫数分複製し、8枚ずつページにまとめる。
 */
export function buildReturnLabelPages(rows: SourceRow[]): ReturnLabelPage[] {
  const allItems: ReturnLabelItem[] = [];

  for (const row of rows) {
    const qty = Math.max(1, Math.floor(Number(row.quantity)) || 1);
    const item: ReturnLabelItem = {
      receptionNo: row.receptionNo,
      repairSlipNo: row.repairSlipNo ?? "",
      orderNo: row.orderNo,
      partNumber: row.partNumber,
      partName: row.partName,
      completedAt: row.completedAt,
    };
    for (let i = 0; i < qty; i++) {
      allItems.push(item);
    }
  }

  const pages: ReturnLabelPage[] = [];
  for (let i = 0; i < allItems.length; i += RETURN_LABEL_ITEMS_PER_PAGE) {
    pages.push({
      pageNo: pages.length + 1,
      items: allItems.slice(i, i + RETURN_LABEL_ITEMS_PER_PAGE),
    });
  }
  return pages;
}
