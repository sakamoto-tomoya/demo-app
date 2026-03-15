"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAllCases, updateCase } from "@/lib/store";
import { findMatchingBankPayments } from "@/lib/bank-payments-store";
import { runAutoMatch } from "@/lib/accounting-flow";
import type { CaseRecord } from "@/lib/types";

/** 請求書発行した案件（請求書を印刷したことがある案件）のみ対象 */
function isInvoiceIssuedCase(c: CaseRecord): boolean {
  return !!(c.invoiceIssuedAt && c.invoiceIssuedAt.trim());
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const s = iso.slice(0, 10);
    return s ? s.replace(/-/g, "/") : "—";
  } catch {
    return "—";
  }
}

function normalizeForSearch(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

function matchSearch(value: string, query: string): boolean {
  if (!query) return true;
  return normalizeForSearch(value).includes(normalizeForSearch(query));
}

export default function InvoiceHistoryPage() {
  const [fullList, setFullList] = useState<CaseRecord[]>([]);
  const [search, setSearch] = useState({
    recipientName: "",
    postalCode: "",
    contact: "",
    receptionNo: "",
  });
  /** 入金状況モーダルで編集中の案件（null で閉じる） */
  const [paymentModalCase, setPaymentModalCase] = useState<CaseRecord | null>(null);
  /** モーダル内で選択中の 入金済/入金未 */
  const [paymentModalValue, setPaymentModalValue] = useState<boolean>(false);
  /** 自動照合の結果メッセージ（表示後にクリア） */
  const [autoMatchMessage, setAutoMatchMessage] = useState<string | null>(null);

  useEffect(() => {
    const cases = getAllCases();
    const filtered = cases.filter(isInvoiceIssuedCase);
    filtered.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    setFullList(filtered);
  }, []);

  const list = useMemo(() => {
    return fullList.filter((c) => {
      const recipientName = (c.completionRecipient ?? c.billingName ?? c.requestStoreName ?? "").trim();
      const postalCode = (c.completionRecipientPostalCode ?? c.billingPostalCode ?? "").trim();
      const contact = [
        c.requestPhone,
        c.requestFax,
        c.requestPhoneFax,
        c.requestContactName,
      ]
        .filter(Boolean)
        .join(" ");
      const receptionNo = (c.receptionNo ?? "").trim();
      if (search.recipientName && !matchSearch(recipientName, search.recipientName)) return false;
      if (search.postalCode && !matchSearch(postalCode, search.postalCode)) return false;
      if (search.contact && !matchSearch(contact, search.contact)) return false;
      if (search.receptionNo && !matchSearch(receptionNo, search.receptionNo)) return false;
      return true;
    });
  }, [fullList, search.recipientName, search.postalCode, search.contact, search.receptionNo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/parts/month-end"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] no-underline"
        >
          ← 月末処理
        </Link>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            請求書発行履歴
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            請求書を発行した案件を請求書作成日（登録日）順で表示します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const result = runAutoMatch();
              setFullList((prev) => {
                const cases = getAllCases();
                const filtered = cases.filter(isInvoiceIssuedCase);
                filtered.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
                return filtered;
              });
              setAutoMatchMessage(
                result.updated > 0
                  ? `${result.updated}件を入金済に更新しました（${result.checked}件を照合）`
                  : `照合完了（${result.checked}件中、新たに一致した案件はありません）`
              );
              setTimeout(() => setAutoMatchMessage(null), 5000);
            }}
            className="app-btn inline-flex shrink-0 px-4 py-2 text-sm"
          >
            自動照合を実行
          </button>
          <Link
            href="/parts/month-end/invoice-history/bank-config"
            className="app-btn app-btn-primary inline-flex shrink-0 px-4 py-2 text-sm no-underline"
          >
            銀行設定
          </Link>
        </div>
      </div>
      {autoMatchMessage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-2 text-sm text-[var(--foreground)]">
          {autoMatchMessage}
        </p>
      )}
      <div className="app-card p-4 md:p-6">
        <p className="mb-3 text-sm font-medium text-[var(--foreground)]">検索</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0">
            <span className="text-sm text-[var(--muted)]">請求先名</span>
            <input
              type="text"
              className={inputClass}
              value={search.recipientName}
              onChange={(e) => setSearch((s) => ({ ...s, recipientName: e.target.value }))}
              placeholder="請求先宛名で検索"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-sm text-[var(--muted)]">郵便番号</span>
            <input
              type="text"
              className={inputClass}
              value={search.postalCode}
              onChange={(e) => setSearch((s) => ({ ...s, postalCode: e.target.value }))}
              placeholder="郵便番号で検索"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-sm text-[var(--muted)]">連絡先</span>
            <input
              type="text"
              className={inputClass}
              value={search.contact}
              onChange={(e) => setSearch((s) => ({ ...s, contact: e.target.value }))}
              placeholder="電話・FAX・担当者名で検索"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-sm text-[var(--muted)]">請求書No</span>
            <input
              type="text"
              className={inputClass}
              value={search.receptionNo}
              onChange={(e) => setSearch((s) => ({ ...s, receptionNo: e.target.value }))}
              placeholder="受付番号で検索"
            />
          </label>
        </div>
        {list.length !== fullList.length && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {list.length}件 / {fullList.length}件
          </p>
        )}
      </div>

      <div className="app-card overflow-hidden p-0">
        {list.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">該当する案件はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    請求書作成日
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    入金予定日
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    受付番号（請求書No）
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    御社指定No
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    請求先宛名
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    連絡先
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    郵便番号
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--foreground)]">
                    住所
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--foreground)]">
                    ご請求金額（税込）
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[var(--foreground)] w-28">
                    請求書
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[var(--foreground)] w-24">
                    入金状況
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const specifiedNo = (c.completionRecipientSpecifiedNo ?? c.requestSpecifiedNo ?? "").trim();
                  const amount = c.completionTotalAmount ?? "";
                  const invoiceUrl = `/cases/${c.id}/complete/print?type=invoice`;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/10"
                    >
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        {formatDate(c.createdAt ?? "")}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        <input
                          type="date"
                          value={(c.completionExpectedPaymentDate ?? "").slice(0, 10)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateCase(c.id, { completionExpectedPaymentDate: v || undefined });
                            setFullList((prev) =>
                              prev.map((r) =>
                                r.id === c.id ? { ...r, completionExpectedPaymentDate: v || undefined } : r
                              )
                            );
                          }}
                          className="block w-full max-w-[10rem] rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                        />
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        {(c.receptionNo ?? "").trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)] whitespace-pre-wrap">
                        {specifiedNo || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        {(c.completionRecipient ?? c.billingName ?? c.requestStoreName ?? "").trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        <span className="inline-flex items-center gap-2">
                          <span>
                            {[c.requestPhone, c.requestFax, c.requestPhoneFax, c.requestContactName]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </span>
                          {(c.requestPhone ?? c.requestPhoneFax ?? "").trim() ? (
                            <a
                              href={`tel:${(c.requestPhone ?? c.requestPhoneFax ?? "").trim().replace(/\s/g, "")}`}
                              className="app-btn app-btn-primary inline-flex px-2 py-1 text-xs no-underline shrink-0"
                            >
                              電話をかける
                            </a>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)]">
                        {(c.completionRecipientPostalCode ?? c.billingPostalCode ?? "").trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)] whitespace-pre-wrap">
                        {(c.completionRecipientAddress ?? c.billingAddress ?? c.requestAddress ?? "").trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--foreground)]">
                        {amount ? `¥${Number(amount).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-btn app-btn-primary inline-flex px-3 py-1.5 text-xs no-underline"
                        >
                          表示
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalCase(c);
                            setPaymentModalValue(!!c.completionPaymentReceived);
                          }}
                          className="text-sm text-[var(--foreground)] underline hover:no-underline"
                        >
                          {c.completionPaymentReceived ? "入金済" : "未入金"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 入金状況モーダル：銀行入金データ照合 → 入金済/入金未を選択 */}
      {paymentModalCase && (
        <PaymentStatusModal
          caseRecord={paymentModalCase}
          selectedValue={paymentModalValue}
          onSelect={setPaymentModalValue}
          onConfirm={() => {
            if (!paymentModalCase) return;
            updateCase(paymentModalCase.id, {
              completionPaymentReceived: paymentModalValue,
            });
            setFullList((prev) =>
              prev.map((r) =>
                r.id === paymentModalCase.id
                  ? { ...r, completionPaymentReceived: paymentModalValue }
                  : r
              )
            );
            setPaymentModalCase(null);
          }}
          onClose={() => setPaymentModalCase(null)}
        />
      )}
    </div>
  );
}

/** 銀行入金データを照合し、入金済/入金未を選択して反映するモーダル */
function PaymentStatusModal({
  caseRecord,
  selectedValue,
  onSelect,
  onConfirm,
  onClose,
}: {
  caseRecord: CaseRecord;
  selectedValue: boolean;
  onSelect: (v: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const matches = useMemo(() => findMatchingBankPayments(caseRecord), [caseRecord]);
  const invoiceDate = caseRecord.createdAt ? caseRecord.createdAt.slice(0, 10).replace(/-/g, "/") : "—";
  const receptionNo = (caseRecord.receptionNo ?? "").trim() || "—";
  const specifiedNo = (caseRecord.completionRecipientSpecifiedNo ?? caseRecord.requestSpecifiedNo ?? "").trim() || "—";
  const recipientName = (caseRecord.completionRecipient ?? caseRecord.billingName ?? caseRecord.requestStoreName ?? "").trim() || "—";
  const postalCode = (caseRecord.completionRecipientPostalCode ?? caseRecord.billingPostalCode ?? "").trim() || "—";
  const amount = caseRecord.completionTotalAmount ? `¥${Number(caseRecord.completionTotalAmount).toLocaleString()}` : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="app-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">入金状況の設定</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          請求書作成日・受付番号・御社指定No・請求先宛名・郵便番号・ご請求金額の全てが一致する銀行入金データを参照しています。
        </p>
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-sm">
          <div className="grid gap-1">
            <span><strong>請求書作成日:</strong> {invoiceDate}</span>
            <span><strong>受付番号（請求書No）:</strong> {receptionNo}</span>
            <span><strong>御社指定No:</strong> {specifiedNo}</span>
            <span><strong>請求先宛名:</strong> {recipientName}</span>
            <span><strong>郵便番号:</strong> {postalCode}</span>
            <span><strong>ご請求金額（税込）:</strong> {amount}</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--foreground)]">
          {matches.length > 0
            ? `銀行入金データに一致する入金が${matches.length}件あります。`
            : "銀行入金データに一致する入金はありません。"}
        </p>
        <div className="mt-4 flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="paymentStatus"
              checked={!selectedValue}
              onChange={() => onSelect(false)}
              className="rounded-full border-[var(--border)]"
            />
            <span className="text-sm">未入金</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="paymentStatus"
              checked={selectedValue}
              onChange={() => onSelect(true)}
              className="rounded-full border-[var(--border)]"
            />
            <span className="text-sm">入金済</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-btn">
            キャンセル
          </button>
          <button type="button" onClick={onConfirm} className="app-btn app-btn-primary">
            反映
          </button>
        </div>
      </div>
    </div>
  );
}
