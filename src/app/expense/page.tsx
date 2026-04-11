"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import {
  getAllExpenseItems,
  addExpenseItem,
  deleteExpenseItem,
  EXPENSE_CATEGORIES,
  type ExpenseItem,
  type ExpenseCategory,
} from "@/lib/expense-store";
import { DateInput } from "@/components/DateInput";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ExpensePage() {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: todayYYYYMMDD(),
    category: "交通費" as ExpenseCategory,
    amount: "",
    memo: "",
  });
  const captureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(getAllExpenseItems());
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = () => {
    if (!receiptPreview) return;
    const amount = parseInt(String(form.amount).replace(/[^0-9０-９]/g, ""), 10) || 0;
    if (amount <= 0) return;
    addExpenseItem({
      date: form.date,
      category: form.category,
      amount,
      memo: form.memo.trim(),
      receiptDataUrl: receiptPreview,
    });
    setItems(getAllExpenseItems());
    setReceiptPreview(null);
    setForm({ date: todayYYYYMMDD(), category: "交通費", amount: "", memo: "" });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("この経費を削除しますか？")) {
      deleteExpenseItem(id);
      setItems(getAllExpenseItems());
    }
  };

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
          経費精算
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          レシートを撮影して項目を登録し、提出用の経費精算書を作成できます。
        </p>
      </div>

      <div className="app-card p-4 md:p-6">
        <h2 className="text-base font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-4">
          レシートを撮影・登録
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => captureInputRef.current?.click()}
            className="app-btn app-btn-primary"
          >
            カメラで撮影
          </button>
          <p className="text-xs text-[var(--muted)] self-center">
            スマホではカメラ、PCではファイル選択で画像を追加できます。
          </p>
        </div>

        {receiptPreview && (
          <div className="mb-4">
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">レシート画像</p>
            <div className="flex flex-wrap gap-4 items-start">
              <img
                src={receiptPreview}
                alt="レシート"
                className="max-h-48 rounded-lg border border-[var(--border)] object-contain"
              />
              <div className="flex-1 min-w-[200px] space-y-3">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">日付</span>
                  <DateInput
                    className={inputClass}
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">項目</span>
                  <select
                    className={inputClass}
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">金額（円）</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="例: 1250"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">備考</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                    placeholder="任意"
                  />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSave} className="app-btn app-btn-primary">
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptPreview(null)}
                    className="app-btn"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="app-card p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2">
            登録済み経費（{items.length}件）　合計: ¥{totalAmount.toLocaleString()}
          </h2>
          {items.length > 0 && (
            <Link href="/expense/print" target="_blank" rel="noopener noreferrer" className="app-btn app-btn-primary no-underline">
              経費精算書を作成
            </Link>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">レシートを撮影して経費を登録してください。</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] p-3"
              >
                <img
                  src={item.receiptDataUrl}
                  alt=""
                  className="h-16 w-16 object-cover rounded border border-[var(--border)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-[var(--foreground)]">{item.date}</span>
                  <span className="mx-2 text-[var(--muted)]">|</span>
                  <span className="text-[var(--foreground)]">{item.category}</span>
                  <span className="mx-2 text-[var(--muted)]">|</span>
                  <span className="font-medium text-[var(--foreground)]">¥{item.amount.toLocaleString()}</span>
                  {item.memo && <p className="text-sm text-[var(--muted)] mt-0.5">{item.memo}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-sm text-[var(--muted)] underline hover:text-[var(--alert)] shrink-0"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
