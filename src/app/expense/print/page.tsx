"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllExpenseItems } from "@/lib/expense-store";
import type { ExpenseItem } from "@/lib/expense-store";

function formatDateYMD(s: string): string {
  if (!s) return "—";
  return s.replace(/-/g, "/");
}

export default function ExpensePrintPage() {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(getAllExpenseItems());
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen p-6 text-[var(--muted)]">
        読み込み中…
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const printDate = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-white p-6 md:p-10 print:p-8">
      <div className="no-print mb-6 flex items-center gap-4">
        <Link href="/expense" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] no-underline">
          ← 経費精算に戻る
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="app-btn app-btn-primary"
        >
          印刷
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[var(--muted)]">登録された経費がありません。経費精算ページでレシートを登録してください。</p>
      ) : (
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-center text-black mb-8">
            経費精算書
          </h1>
          <p className="text-right text-sm text-black mb-6">
            作成日: {printDate}
          </p>

          <table className="w-full border-collapse border border-black text-black text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-3 py-2 text-left font-medium w-24">日付</th>
                <th className="border border-black px-3 py-2 text-left font-medium">項目</th>
                <th className="border border-black px-3 py-2 text-right font-medium w-28">金額（円）</th>
                <th className="border border-black px-3 py-2 text-left font-medium">備考</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black px-3 py-2">{formatDateYMD(item.date)}</td>
                  <td className="border border-black px-3 py-2">{item.category}</td>
                  <td className="border border-black px-3 py-2 text-right">{item.amount.toLocaleString()}</td>
                  <td className="border border-black px-3 py-2">{item.memo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <p className="text-base font-bold">
              合計: ¥{total.toLocaleString()}
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-black">
            <p className="text-sm font-medium text-black mb-2">レシート等（添付）</p>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <p className="text-xs text-black mb-1">
                    {formatDateYMD(item.date)} {item.category} ¥{item.amount.toLocaleString()}
                  </p>
                  <img
                    src={item.receiptDataUrl}
                    alt=""
                    className="w-full max-h-40 object-contain border border-gray-300 rounded"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
