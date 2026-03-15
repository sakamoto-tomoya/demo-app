import { auth, signIn, signOut } from "@/auth";
import StatusCards from "@/components/StatusCards";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="min-h-screen">
        {/* 1. Hero */}
        <section className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl lg:text-5xl">
              AI修理業務管理システム
            </h1>
            <p className="mt-6 text-lg text-[var(--muted)] md:text-xl">
              現場対応が必要な修理・保守業務を、OCR・地図・案件管理・部品管理・入金管理で一元化する業務支援アプリ
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="app-btn app-btn-primary px-8 py-3.5 text-base shadow-[var(--shadow)]"
                >
                  デモを見る
                </button>
              </form>
              <Link
                href="#features"
                className="app-btn app-btn-secondary inline-flex items-center gap-2 px-8 py-3.5 text-base shadow-[var(--shadow-sm)]"
              >
                主な機能を見る
              </Link>
            </div>
            <p className="mt-6 text-sm text-[var(--muted)]">
              ポートフォリオ用デモ画面です
            </p>
          </div>
        </section>

        {/* 2. Business issues */}
        <section className="px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              現場業務でよくある課題
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "紙伝票や受付内容の転記に時間がかかる",
                "訪問先や案件状況の把握が分散している",
                "部品や対応履歴が属人化しやすい",
                "請求・入金確認まで一元管理しづらい",
              ].map((text) => (
                <div
                  key={text}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]"
                >
                  <p className="text-sm font-medium leading-relaxed text-[var(--foreground)]">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Solution */}
        <section className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              このシステムで解決できること
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "案件管理", desc: "依頼内容・顧客情報・進捗を一元管理" },
                { title: "書類OCR登録", desc: "紙帳票やPDFの内容を読み取り登録を効率化" },
                { title: "訪問先マップ管理", desc: "住所情報を地図で可視化し訪問効率を向上" },
                { title: "部品履歴管理", desc: "使用部品や対応履歴を蓄積し再発対応を支援" },
                { title: "入金管理", desc: "請求後の入金状況を一覧で確認" },
              ].map(({ title, desc }) => (
                <div
                  key={title}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-6"
                >
                  <h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Feature highlight */}
        <section id="features" className="scroll-mt-6 px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              主な機能
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "案件管理", desc: "受付から完了まで案件のライフサイクルを管理", icon: "clipboard" },
                { title: "OCR登録", desc: "書類をスキャンして項目を自動転記", icon: "scan" },
                { title: "地図表示", desc: "訪問先を地図上で確認・ルート把握", icon: "map" },
                { title: "部品管理", desc: "入庫・出庫・在庫・棚卸を一元管理", icon: "package" },
                { title: "入金確認", desc: "請求書と入金データの照合・ステータス更新", icon: "bank" },
                { title: "管理設定", desc: "担当者・権限・メール等の設定", icon: "settings" },
              ].map(({ title, desc, icon }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                    <FeatureIcon name={icon} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Benefits */}
        <section className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              導入イメージ / 効果
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "登録作業の削減",
                "情報の一元化",
                "対応漏れの防止",
                "属人化の軽減",
              ].map((text) => (
                <div
                  key={text}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-6 text-center"
                >
                  <p className="font-semibold text-[var(--foreground)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Tech */}
        <section className="px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              技術構成
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {[
                "Next.js / React",
                "Vercel",
                "Auth.js / 認証",
                "Supabase",
                "Google OCR / Document AI",
                "Google Maps API",
                "AI連携",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[var(--muted)]">
              業務課題をもとに設計した、現場向け業務支援システムのポートフォリオです。
            </p>
          </div>
        </section>

        {/* 7. Footer note */}
        <footer className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-8">
          <p className="mx-auto max-w-3xl text-center text-xs text-[var(--muted)] leading-relaxed">
            この画面はポートフォリオ用デモです。実運用向けには認証・権限制御・DB設計・API制御を拡張可能です。
          </p>
        </footer>
      </main>
    );
  }

  const displayName =
    session.user.name ?? session.user.email ?? "ログイン中";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            業務ダッシュボード
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            現場対応が必要な修理・保守業務を効率化するための業務支援アプリ
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {displayName} でログインしています
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="app-btn app-btn-secondary px-5 py-2.5 text-sm"
          >
            ログアウト
          </button>
        </form>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">このシステムでできること</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--muted)]">
          <li>案件管理</li>
          <li>書類OCR自動登録</li>
          <li>訪問先地図管理</li>
          <li>部品履歴管理</li>
          <li>入金確認</li>
        </ul>
      </div>
      <p className="text-sm text-[var(--muted)]">
        ステータス別の件数です。カードをクリックで下に詳細一覧を表示します。
      </p>
      <StatusCards />
    </div>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const size = 24;
  switch (name) {
    case "clipboard":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
        </svg>
      );
    case "scan":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <rect width="14" height="8" x="5" y="8" rx="1" />
        </svg>
      );
    case "map":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "package":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
      );
    case "bank":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="2" x2="22" y1="20" y2="20" /><path d="M5 20V10l7-4 7 4v10" /><path d="M5 10h14" /><path d="M9 14v2" /><path d="M15 14v2" />
        </svg>
      );
    case "settings":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}
