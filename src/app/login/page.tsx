"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] min-w-0";

/** オープンリダイレクト防止: 同一オリジンかつパスのみ許可 */
function sanitizeCallbackUrl(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const s = raw.trim();
  if (s === "" || !s.startsWith("/") || s.startsWith("//")) return "/";
  return s;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const unconfigured = searchParams.get("unconfigured") === "1";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.push(callbackUrl);
        router.refresh();
        return;
      }
      if (res.status === 503 && data.error === "unconfigured") {
        setError("管理者によりログインは無効化されています。");
        return;
      }
      if (res.status === 429) {
        setError("試行回数が多すぎます。しばらく待ってからお試しください。");
        return;
      }
      setError("パスワードが正しくありません");
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  if (unconfigured) {
    return (
      <div className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">アクセス保護</h1>
        <p className="text-sm text-[var(--muted)]">
          管理者によりログインは無効化されています。ACCESS_PASSWORD が設定されていません。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">アクセス保護</h1>
      <p className="text-sm text-[var(--muted)]">
        このデモサイトは保護されています。パスワードを入力してください。
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="パスワード"
            autoFocus
            autoComplete="current-password"
            disabled={loading}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Suspense fallback={<p className="text-[var(--muted)]">読み込み中…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
