import DashboardBody from "./DashboardBody";

export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            案件管理
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            ステータス別の件数と案件一覧を確認できます
          </p>
        </div>
      </div>
      <DashboardBody />
    </div>
  );
}
