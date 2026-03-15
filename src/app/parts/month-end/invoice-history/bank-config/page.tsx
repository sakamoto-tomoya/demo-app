"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getAllBankStatementLinks,
  addBankStatementLink,
  deleteBankStatementLink,
} from "@/lib/bank-statement-links-store";
import { addBankPayment } from "@/lib/bank-payments-store";
import { runAutoMatch } from "@/lib/accounting-flow";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

export default function BankConfigPage() {
  const [authStatus, setAuthStatus] = useState<"loading" | "unauthenticated" | "authenticated">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [statementLinks, setStatementLinks] = useState(getAllBankStatementLinks());
  const [newBankName, setNewBankName] = useState("");
  const [newBankUrl, setNewBankUrl] = useState("");
  const [fetchBankUrl, setFetchBankUrl] = useState("");
  const [fetchBankApiKey, setFetchBankApiKey] = useState("");
  const [fetchBankLoading, setFetchBankLoading] = useState(false);
  const [fetchBankResult, setFetchBankResult] = useState<string | null>(null);

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

  useEffect(() => {
    if (authStatus === "authenticated") {
      setStatementLinks(getAllBankStatementLinks());
    }
  }, [authStatus]);

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBankName.trim();
    const url = newBankUrl.trim();
    if (!name || !url) return;
    addBankStatementLink({ bankName: name, url });
    setNewBankName("");
    setNewBankUrl("");
    setStatementLinks(getAllBankStatementLinks());
  };

  const handleDeleteLink = (id: string) => {
    deleteBankStatementLink(id);
    setStatementLinks(getAllBankStatementLinks());
  };

  const handleFetchBankAndMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = fetchBankUrl.trim();
    if (!url) return;
    setFetchBankLoading(true);
    setFetchBankResult(null);
    try {
      const res = await fetch("/api/accounting/fetch-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey: fetchBankApiKey.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchBankResult(data?.error ?? "取得に失敗しました");
        return;
      }
      if (data?.error) {
        setFetchBankResult(data.error + (data.payments?.length ? `（${data.payments.length}件は取得済み）` : ""));
      }
      const payments = Array.isArray(data?.payments) ? data.payments : [];
      for (const p of payments) {
        addBankPayment({
          invoiceDate: p.invoiceDate ?? "",
          receptionNo: p.receptionNo ?? "",
          specifiedNo: p.specifiedNo ?? "",
          recipientName: p.recipientName ?? "",
          postalCode: p.postalCode ?? "",
          amount: p.amount ?? "",
        });
      }
      const matchResult = runAutoMatch();
      const msg = [
        payments.length > 0 ? `${payments.length}件を入金データに登録` : "取得した入金データは0件",
        `照合: ${matchResult.updated}件を入金済に更新（${matchResult.checked}件を照合）`,
      ].join("。");
      setFetchBankResult(msg);
    } catch (err) {
      setFetchBankResult(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setFetchBankLoading(false);
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
            href="/parts/month-end/invoice-history"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] no-underline"
          >
            ← 請求書発行履歴
          </Link>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">銀行設定</h1>
        <p className="text-[var(--muted)]">
          経理担当者のみアクセスできます。設定で「経理担当」にチェックされた担当者のメールアドレスとパスワードでログインしてください。
        </p>
        <form onSubmit={handleLogin} className="max-w-sm space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
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
            <p className="text-sm text-[var(--alert)]">メールアドレスまたはパスワードが正しくありません。経理担当に設定されているかご確認ください。</p>
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
          銀行設定
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          銀行・入金に関する設定を行います。
        </p>
      </div>

      <div className="app-card p-4 md:p-6">
        <h2 className="text-base font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-4">
          各銀行の入出金明細へアクセス
        </h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          各銀行の入出金明細ページのURLを登録すると、ここからワンクリックでアクセスできます。
        </p>
        <form onSubmit={handleAddLink} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1" style={{ minWidth: "120px" }}>
            <span className="text-xs text-[var(--muted)]">銀行名</span>
            <input
              type="text"
              className={inputClass}
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              placeholder="例: 横浜銀行"
            />
          </label>
          <label className="min-w-0 flex-1" style={{ minWidth: "200px" }}>
            <span className="text-xs text-[var(--muted)]">入出金明細のURL</span>
            <input
              type="url"
              className={inputClass}
              value={newBankUrl}
              onChange={(e) => setNewBankUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <button type="submit" className="app-btn app-btn-primary shrink-0">
            登録
          </button>
        </form>
        {statementLinks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">登録された銀行はありません。</p>
        ) : (
          <ul className="space-y-2">
            {statementLinks.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              >
                <span className="font-medium text-[var(--foreground)]">{link.bankName}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-btn app-btn-primary inline-flex px-3 py-1.5 text-sm no-underline"
                >
                  開く
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteLink(link.id)}
                  className="text-sm text-[var(--muted)] underline hover:text-[var(--alert)]"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="app-card p-4 md:p-6">
        <h2 className="text-base font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-4">
          入金取得（銀行API）
        </h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          請求書発行 → 入金 → 銀行API → 入金取得 → 案件と自動照合 → ステータス更新。APIのURLを指定すると入金データを取得し、登録後に自動照合で入金済に更新します。
        </p>
        <form onSubmit={handleFetchBankAndMatch} className="mb-4 space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">API URL（JSON配列または {"{ payments: [] }"} 形式）</span>
            <input
              type="url"
              className={inputClass}
              value={fetchBankUrl}
              onChange={(e) => setFetchBankUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">APIキー（任意）</span>
            <input
              type="password"
              className={inputClass}
              value={fetchBankApiKey}
              onChange={(e) => setFetchBankApiKey(e.target.value)}
              placeholder="Bearer で送信"
            />
          </label>
          <button type="submit" disabled={fetchBankLoading} className="app-btn app-btn-primary">
            {fetchBankLoading ? "取得中…" : "取得して登録・自動照合"}
          </button>
        </form>
        {fetchBankResult && (
          <p className="rounded border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-sm text-[var(--foreground)]">
            {fetchBankResult}
          </p>
        )}
      </div>

      <div className="app-card p-4 md:p-6">
        <h2 className="text-base font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-2">
          銀行入金データ設定
        </h2>
        <Link
          href="/parts/month-end/invoice-history/bank-settings"
          className="block rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center text-[var(--foreground)] hover:bg-[var(--background)] active:opacity-80"
        >
          銀行入金データ設定
        </Link>
        <p className="ml-3 mt-0.5 text-xs text-[var(--muted)]">
          各銀行の入金データを手動・CSVで登録し、請求書発行履歴の入金状況と照合できます。
        </p>
      </div>
    </div>
  );
}
