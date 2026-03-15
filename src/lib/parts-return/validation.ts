/**
 * 部品返品伝票・返品シール 入力検証
 * 要件定義 4-3. 入力検証機能
 */

import type { SourceRow, ValidationError } from "./types";

function parseDate(value: string): Date | null {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 元データー行一覧を検証し、エラー一覧を返す。
 * エラーが1件でもあれば処理を中断する前提で、全件検証する。
 */
export function validateSourceRows(rows: SourceRow[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const row of rows) {
    const { rowNo, partNumber, partName, quantity, staffName, receptionNo, orderNo, billingType, completedAt } = row;

    // 必須チェック
    if (!String(partNumber).trim()) {
      errors.push({ rowNo, field: "部品品番", message: "部品品番が空です。" });
    }
    if (!String(partName).trim()) {
      errors.push({ rowNo, field: "部品名称", message: "部品名称が空です。" });
    }
    if (quantity == null || String(quantity).trim() === "") {
      errors.push({ rowNo, field: "出庫数", message: "出庫数が空です。" });
    }
    if (!String(staffName).trim()) {
      errors.push({ rowNo, field: "出庫担当者", message: "出庫担当者が空です。" });
    }
    if (!String(receptionNo).trim()) {
      errors.push({ rowNo, field: "受付番号", message: "受付番号が空です。" });
    }
    if (!String(orderNo).trim()) {
      errors.push({ rowNo, field: "オーダー番号", message: "オーダー番号が空です。" });
    }
    if (!String(billingType).trim()) {
      errors.push({ rowNo, field: "請求区分", message: "請求区分が空です。" });
    }

    // 数値チェック（出庫数）
    if (quantity != null && String(quantity).trim() !== "") {
      const n = Number(quantity);
      if (!Number.isInteger(n)) {
        errors.push({ rowNo, field: "出庫数", message: "出庫数は整数で入力してください。" });
      } else if (n < 1) {
        errors.push({ rowNo, field: "出庫数", message: "出庫数は1以上である必要があります。" });
      }
    }

    // 日付チェック（完了日）
    if (completedAt != null && String(completedAt).trim() !== "") {
      const d = parseDate(String(completedAt));
      if (!d) {
        errors.push({ rowNo, field: "完了日", message: "完了日は日付として解釈できる形式で入力してください。" });
      }
    }
  }

  return errors;
}
