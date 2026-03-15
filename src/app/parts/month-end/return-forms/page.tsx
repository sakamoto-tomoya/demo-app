"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getAllOutbound } from "@/lib/parts-store";
import {
  prepareSourceRows,
  buildSlipPages,
  buildLabelPages,
  type PrepareResult,
} from "@/lib/parts-return/useCase";
import type { PartsSlipPage, ReturnLabelPage } from "@/lib/parts-return/types";
import { buildPartsSlipHtml } from "@/lib/parts-return/printSlip";
import { buildReturnLabelHtml } from "@/lib/parts-return/printSeal";
import {
  recordPartsSlip,
  recordReturnLabel,
  getDesignatedSlip,
  getDesignatedLabel,
  clearAllDesignated,
} from "@/lib/parts-return/designatedData";

function openPrintWindow(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("ポップアップがブロックされています。印刷用に別タブで開きます。");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

function formatRecordedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
  } catch {
    return iso;
  }
}

export default function ReturnFormsPage() {
  const [slipPages, setSlipPages] = useState<PartsSlipPage[] | null>(null);
  const [labelPages, setLabelPages] = useState<ReturnLabelPage[] | null>(null);
  const [designatedSlip, setDesignatedSlip] = useState<{ recordedAt: string; pageCount: number } | null>(null);
  const [designatedLabel, setDesignatedLabel] = useState<{ recordedAt: string; pageCount: number; totalItems: number } | null>(null);
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);

  useEffect(() => {
    const list = getAllOutbound();
    setPrepared(prepareSourceRows(list));
    const s = getDesignatedSlip();
    const l = getDesignatedLabel();
    if (s) {
      setSlipPages(s.pages);
      setDesignatedSlip({ recordedAt: s.recordedAt, pageCount: s.pageCount });
    }
    if (l) {
      setLabelPages(l.pages);
      setDesignatedLabel({ recordedAt: l.recordedAt, pageCount: l.pageCount, totalItems: l.totalItems });
    }
  }, []);

  const hasErrors = prepared ? !prepared.ok : false;
  const errors = hasErrors && prepared ? prepared.errors : [];
  const rows = prepared?.ok ? prepared.rows : [];
  const slipPageCount = slipPages?.length ?? 0;
  const labelTotal = labelPages?.reduce((s, p) => s + p.items.length, 0) ?? 0;
  const labelPageCount = labelPages?.length ?? 0;

  const handleGenerateSlip = () => {
    if (hasErrors || rows.length === 0) return;
    const { slipPages: pages } = buildSlipPages(rows);
    setSlipPages(pages);
    recordPartsSlip(pages);
    setDesignatedSlip({ recordedAt: new Date().toISOString(), pageCount: pages.length });
  };

  const handleGenerateLabel = () => {
    if (hasErrors || rows.length === 0) return;
    const { labelPages: pages } = buildLabelPages(rows);
    setLabelPages(pages);
    recordReturnLabel(pages);
    const totalItems = pages.reduce((s, p) => s + p.items.length, 0);
    setDesignatedLabel({ recordedAt: new Date().toISOString(), pageCount: pages.length, totalItems });
  };

  const handlePrintSlip = () => {
    if (!slipPages || slipPages.length === 0) return;
    openPrintWindow(buildPartsSlipHtml(slipPages), "部品伝票");
  };

  const handlePrintLabel = () => {
    if (!labelPages || labelPages.length === 0) return;
    openPrintWindow(buildReturnLabelHtml(labelPages), "返品シール");
  };

  const handleClear = () => {
    setSlipPages(null);
    setLabelPages(null);
    setDesignatedSlip(null);
    setDesignatedLabel(null);
    clearAllDesignated();
  };

  const previewSlipPages = prepared?.ok && rows.length > 0 ? buildSlipPages(rows).slipPages.length : 0;
  const previewLabel = prepared?.ok && rows.length > 0 ? buildLabelPages(rows) : null;
  const previewLabelTotal = previewLabel?.labelPages.reduce((s, p) => s + p.items.length, 0) ?? 0;
  const previewLabelPages = previewLabel?.labelPages.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Link
          href="/parts/month-end"
          className="app-btn app-btn-secondary w-fit px-4 py-2.5 text-sm no-underline"
        >
          ← 月末処理へ
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            無償使用部品返却帳票作成
          </h1>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">
        出庫データのうち「請求区分＝無償・無償Y・無料」の行を対象に、部品伝票と返品シールを生成します。生成したデータは指定データに転記され、アプリ内に保存されます。
      </p>

      {/* 指定データ（転記済み） */}
      {(designatedSlip || designatedLabel) && (
        <section className="app-card p-6">
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">指定データ（転記済み）</h2>
          <ul className="space-y-1 text-sm text-[var(--foreground)]">
            {designatedSlip && (
              <li>部品伝票: {designatedSlip.pageCount} ページ（転記日時: {formatRecordedAt(designatedSlip.recordedAt)}）</li>
            )}
            {designatedLabel && (
              <li>返品シール: {designatedLabel.totalItems} 枚 / {designatedLabel.pageCount} ページ（転記日時: {formatRecordedAt(designatedLabel.recordedAt)}）</li>
            )}
          </ul>
        </section>
      )}

      {/* エラー表示 */}
      {hasErrors && errors.length > 0 && (
        <section className="app-card rounded-[var(--radius-lg)] border-2 border-[var(--alert)] bg-[var(--alert-bg)] p-5">
          <h2 className="mb-2 text-base font-semibold text-[var(--alert)]">入力エラー（処理を中断しました）</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
            {errors.map((e, i) => (
              <li key={i}>
                {e.rowNo}行目 {e.field}: {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* プレビュー（件数・ページ見込み・出庫一覧の対象行） */}
      <section className="app-card p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">プレビュー</h2>
        <ul className="mb-3 space-y-1 text-sm text-[var(--foreground)]">
          <li>対象件数（請求区分＝無償・無償Y・無料）: {rows.length} 件</li>
          <li>部品伝票 ページ数見込み: {previewSlipPages} ページ</li>
          <li>返品シール 枚数見込み: {previewLabelTotal} 枚 / ページ数見込み: {previewLabelPages} ページ</li>
        </ul>
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">対象データ（出庫一覧の請求区分が無償・無償Y・無料の行）</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--border)]/30">
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">部品品番</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">出庫日</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">部品名称</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-right">出庫数</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">出庫担当者</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">受付番号</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">オーダー番号</th>
                  <th className="border border-[var(--border)] px-2 py-1.5 text-left">請求区分</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.partNumber}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.completedAt}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.partName}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-right">{r.quantity}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.staffName}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.receptionNo}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.orderNo}</td>
                    <td className="border border-[var(--border)] px-2 py-1.5">{r.billingType || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 実行ボタン */}
      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateSlip}
          disabled={hasErrors || rows.length === 0}
          className="app-btn app-btn-secondary px-5 py-3 text-sm disabled:opacity-50"
        >
          部品伝票を生成
        </button>
        <button
          type="button"
          onClick={handleGenerateLabel}
          disabled={hasErrors || rows.length === 0}
          className="app-btn app-btn-secondary px-5 py-3 text-sm disabled:opacity-50"
        >
          返品シールを生成
        </button>
      </section>

      {/* 生成済み → 印刷・PDF */}
      {(slipPageCount > 0 || labelPageCount > 0) && (
        <section className="app-card p-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">出力</h2>
          <div className="flex flex-wrap gap-3">
            {slipPageCount > 0 && (
              <button
                type="button"
                onClick={handlePrintSlip}
                className="app-btn app-btn-primary px-5 py-2.5 text-sm"
              >
                部品伝票を印刷（PDF保存可）
              </button>
            )}
            {labelPageCount > 0 && (
              <button
                type="button"
                onClick={handlePrintLabel}
                className="app-btn app-btn-primary px-5 py-2.5 text-sm"
              >
                返品シールを印刷（PDF保存可）
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="app-btn app-btn-secondary px-5 py-2.5 text-sm"
            >
              クリア
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
