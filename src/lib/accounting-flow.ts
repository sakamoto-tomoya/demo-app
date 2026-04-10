"use client";

/**
 * 請求書発行 → 入金 → 銀行API → 入金取得 → 案件と自動照合 → ステータス更新
 *
 * 1. 請求書発行: 請求書を印刷した案件（invoiceIssuedAt が設定された案件）
 * 2. 入金: 実務で入金される
 * 3. 銀行API: 入金データの取得元（手動登録・CSV・または外部API）
 * 4. 入金取得: 銀行入金データ設定で登録、または API/URL から取得
 * 5. 案件と自動照合: 登録済み入金データと請求書発行した案件の6項目で照合
 * 6. ステータス更新: 一致した案件を入金済に更新
 */

import { getAllCases } from "@/lib/store";
import { updateCase } from "@/lib/store";
import { findMatchingBankPayments } from "@/lib/bank-payments-store";
import type { CaseRecord } from "@/lib/types";

/** 請求書発行した案件（請求書を印刷したことがある案件）のみ対象 */
function isInvoiceIssuedCase(c: CaseRecord): boolean {
  return !!(c.invoiceIssuedAt && c.invoiceIssuedAt.trim());
}

export type AutoMatchResult = {
  updated: number;
  checked: number;
  details: { caseId: string; receptionNo: string; matched: boolean }[];
};

/**
 * 案件と銀行入金データを自動照合し、一致した案件を入金済に更新する。
 * 請求書を発行した案件（invoiceIssuedAt が設定されている案件）のみ対象。
 */
export async function runAutoMatch(): Promise<AutoMatchResult> {
  const cases = await getAllCases();
  const relevant = cases.filter(isInvoiceIssuedCase);
  const details: AutoMatchResult["details"] = [];
  let updated = 0;

  for (const c of relevant) {
    const matches = findMatchingBankPayments(c);
    const matched = matches.length > 0;
    details.push({
      caseId: c.id,
      receptionNo: (c.receptionNo ?? "").trim() || "—",
      matched,
    });
    if (matched && !c.completionPaymentReceived) {
      await updateCase(c.id, { completionPaymentReceived: true });
      updated++;
    }
  }

  return {
    updated,
    checked: relevant.length,
    details,
  };
}
