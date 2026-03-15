import { auth, signIn, signOut } from "@/auth";
import StatusCards from "@/components/StatusCards";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
        <p className="text-center text-[var(--muted)]">
          デモをご利用になるにはログインしてください。
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="app-btn app-btn-primary px-8 py-3.5 text-base"
          >
            Googleでログイン
          </button>
        </form>
      </div>
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
