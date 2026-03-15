"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllCases } from "@/lib/store";
import { getStatusLabel, type CaseRecord } from "@/lib/types";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

function normalizeForSearch(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d ? d.replace(/-/g, "/") : "—";
}

export default function HistoryPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [receptionNo, setReceptionNo] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    setCases(getAllCases());
  }, []);

  const filtered = cases.filter((c) => {
    const cn = normalizeForSearch(customerName);
    const rn = normalizeForSearch(receptionNo);
    const ph = normalizeForSearch(phone);
    if (cn && !normalizeForSearch(c.customerName ?? "").includes(cn)) return false;
    if (rn && !normalizeForSearch(c.receptionNo ?? "").includes(rn)) return false;
    const tel = [c.phone, c.mobile, c.requestPhone].filter(Boolean).join(" ");
    if (ph && !normalizeForSearch(tel).includes(ph)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        履歴検索
      </h1>
      <p className="text-[var(--muted)]">
        お客様名・受付番号・電話番号で案件を検索できます。
      </p>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">お客様名（カタカナ・漢字・ひらがな）</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputClass}
              placeholder="お客様名で検索"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">受付番号</span>
            <input
              type="text"
              value={receptionNo}
              onChange={(e) => setReceptionNo(e.target.value)}
              className={inputClass}
              placeholder="受付番号で検索"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">電話番号（自宅・携帯）</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="電話番号で検索"
            />
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--border)]/30">
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">受付番号</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">お客様名（カタカナ・漢字・ひらがな）</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">電話番号（自宅・携帯）</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">登録日</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">ステータス</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">受付日</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">完了日</th>
                <th className="border-b border-[var(--border)] px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-[var(--muted)]">
                    {cases.length === 0 ? "案件がありません" : "条件に一致する案件がありません"}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{c.receptionNo ?? "—"}</td>
                    <td className="px-3 py-2">{c.customerName ?? "—"}</td>
                    <td className="px-3 py-2">
                      {[c.phone, c.mobile].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-3 py-2">{formatDate(c.createdAt)}</td>
                    <td className="px-3 py-2">{getStatusLabel(c.status)}</td>
                    <td className="px-3 py-2">{c.receptionDate ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.status === "completed" ? formatDate(c.updatedAt ?? c.createdAt) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/cases/${c.id}/edit`}
                        className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
