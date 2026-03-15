"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getAllBankPayments,
  addBankPayment,
  deleteBankPayment,
  addBankPaymentsFromCsv,
} from "@/lib/bank-payments-store";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

export default function BankSettingsPage() {
  const [authStatus, setAuthStatus] = useState<"loading" | "unauthenticated" | "authenticated">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);

  useEffect(() => {
    fetch("/api/auth/accounting")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data?.ok) setAuthStatus("authenticated");
        else setAuthStatus("unauthenticated");
      })
      .catch(() => setAuthStatus("unauthenticated"));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    fetch("/api/auth/accounting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    })
      .then((res) => {
        if (res.ok) {
          setAuthStatus("authenticated");
          setEmail("");
          setPassword("");
        } else {
          setLoginError(true);
        }
      })
      .catch(() => setLoginError(true));
  };

  const [bankPayments, setBankPayments] = useState(getAllBankPayments());
  const [form, setForm] = useState({
    invoiceDate: "",
    receptionNo: "",
    specifiedNo: "",
    recipientName: "",
    postalCode: "",
    amount: "",
  });
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<{ added: number; errors: string[] } | null>(null);

  const refresh = () => setBankPayments(getAllBankPayments());

  const handleAdd = () => {
    if (
      !form.invoiceDate.trim() ||
      !form.receptionNo.trim() ||
      !form.specifiedNo.trim() ||
      !form.recipientName.trim() ||
      !form.postalCode.trim() ||
      !form.amount.trim()
    ) {
      return;
    }
    addBankPayment({
      invoiceDate: form.invoiceDate.trim(),
      receptionNo: form.receptionNo.trim(),
      specifiedNo: form.specifiedNo.trim(),
      recipientName: form.recipientName.trim(),
      postalCode: form.postalCode.trim(),
      amount: form.amount.trim(),
    });
    setForm({
      invoiceDate: "",
      receptionNo: "",
      specifiedNo: "",
      recipientName: "",
      postalCode: "",
      amount: "",
    });
    refresh();
  };

  const handleCsvImport = () => {
    const result = addBankPaymentsFromCsv(csvText);
    setCsvResult(result);
    if (result.added > 0) {
      setCsvText("");
      refresh();
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-[var(--muted)]">
        確認中…
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/parts/month-end/invoice-history/bank-config"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] no-underline"
          >
            ← 銀行設定
          </Link>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">銀行入金データ設定</h1>
        <p className="text-[var(--muted)]">経理担当者のメールアドレスとパスワードでログインしてください。</p>
        <form
          onSubmit={handleLogin}
          className="max-w-sm space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
        >
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="担当者のメールアドレス"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="担当者のパスワード"
              required
            />
          </label>
          {loginError && (
            <p className="text-sm text-[var(--alert)]">メールアドレスまたはパスワードが正しくありません。</p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/parts/month-end/invoice-history"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] no-underline"
        >
          ← 請求書発行履歴
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
          銀行入金データ設定
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          各銀行の入金データを登録すると、請求書発行履歴の「入金状況」で照合して入金済/未入金を選べます。請求書作成日・受付番号・御社指定No・請求先宛名・郵便番号・ご請求金額の6項目が全て一致するデータを参照します。
        </p>
      </div>

      <div className="app-card p-4 md:p-6 space-y-6">
        <section>
          <h2 className="text-base font-medium text-[var(--foreground)] mb-3">1件ずつ追加</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">請求書作成日</span>
              <input
                type="text"
                className={inputClass}
                placeholder="yyyy-mm-dd"
                value={form.invoiceDate}
                onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">受付番号（請求書No）</span>
              <input
                type="text"
                className={inputClass}
                value={form.receptionNo}
                onChange={(e) => setForm((f) => ({ ...f, receptionNo: e.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">御社指定No</span>
              <input
                type="text"
                className={inputClass}
                value={form.specifiedNo}
                onChange={(e) => setForm((f) => ({ ...f, specifiedNo: e.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">請求先宛名</span>
              <input
                type="text"
                className={inputClass}
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">郵便番号</span>
              <input
                type="text"
                className={inputClass}
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-[var(--muted)]">ご請求金額（税込）</span>
              <input
                type="text"
                className={inputClass}
                placeholder="数値"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" onClick={handleAdd} className="mt-3 app-btn app-btn-primary text-sm">
            1件追加
          </button>
        </section>

        <section>
          <h2 className="text-base font-medium text-[var(--foreground)] mb-3">CSVで一括取り込み</h2>
          <p className="text-sm text-[var(--muted)] mb-2">
            1行1件。カンマ区切りで: 請求書作成日,受付番号,御社指定No,請求先宛名,郵便番号,金額（1行目はヘッダーの場合はスキップされません。全てデータ行として扱います）
          </p>
          <textarea
            className={`${inputClass} min-h-[120px] font-mono text-xs`}
            placeholder="2026-03-15,A001,横浜市南区 中里 エンイチ様分,株式会社サンプル,220-0000,55000"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvResult(null);
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={handleCsvImport} className="app-btn app-btn-primary text-sm">
              CSVを読み込んで追加
            </button>
            {csvResult && (
              <span className="text-sm text-[var(--muted)]">
                {csvResult.added}件追加
                {csvResult.errors.length > 0 && ` / ${csvResult.errors.length}件エラー`}
              </span>
            )}
          </div>
          {csvResult && csvResult.errors.length > 0 && (
            <ul className="mt-2 text-sm text-[var(--alert)] list-disc list-inside">
              {csvResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {csvResult.errors.length > 10 && (
                <li>他 {csvResult.errors.length - 10} 件のエラー</li>
              )}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-base font-medium text-[var(--foreground)] mb-2">
            登録済み {bankPayments.length}件
          </h2>
          {bankPayments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">まだ登録がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                    <th className="px-2 py-2 text-left font-medium">請求書作成日</th>
                    <th className="px-2 py-2 text-left font-medium">受付番号</th>
                    <th className="px-2 py-2 text-left font-medium">御社指定No</th>
                    <th className="px-2 py-2 text-left font-medium">請求先宛名</th>
                    <th className="px-2 py-2 text-left font-medium">郵便番号</th>
                    <th className="px-2 py-2 text-right font-medium">金額</th>
                    <th className="px-2 py-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {bankPayments.map((b) => (
                    <tr key={b.id} className="border-b border-[var(--border)]">
                      <td className="px-2 py-2">{b.invoiceDate}</td>
                      <td className="px-2 py-2">{b.receptionNo}</td>
                      <td className="px-2 py-2 whitespace-pre-wrap">{b.specifiedNo}</td>
                      <td className="px-2 py-2">{b.recipientName}</td>
                      <td className="px-2 py-2">{b.postalCode}</td>
                      <td className="px-2 py-2 text-right">{b.amount}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteBankPayment(b.id);
                            refresh();
                          }}
                          className="text-xs text-[var(--muted)] underline hover:text-[var(--alert)]"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
