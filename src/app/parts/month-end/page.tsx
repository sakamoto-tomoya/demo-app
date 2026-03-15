import Link from "next/link";

export default function MonthEndPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
          月末処理
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          月末処理の内容はここに表示されます。
        </p>
      </div>
      <div className="app-card p-6 flex flex-wrap items-center gap-3">
        <Link
          href="/parts/month-end/return-forms"
          className="app-btn app-btn-primary inline-flex px-6 py-3 text-sm no-underline"
        >
          無償使用部品返却帳票作成
        </Link>
        <Link
          href="/parts/month-end/invoice-history"
          className="app-btn app-btn-primary inline-flex px-6 py-3 text-sm no-underline"
        >
          請求書発行履歴
        </Link>
      </div>
    </div>
  );
}
