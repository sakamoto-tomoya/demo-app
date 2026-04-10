import Link from "next/link";

type CompletePageProps = {
  searchParams?: Promise<{
    reservationNumber?: string;
    menuName?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    peopleCount?: string;
  }>;
};

export default async function ReservationCompletePage({ searchParams }: CompletePageProps) {
  const sp = (await searchParams) ?? {};
  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">予約が完了しました</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          ご登録のメールアドレスへ確認通知を送信しました（設定がある場合）。
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
        <p>予約番号: {sp.reservationNumber ?? "—"}</p>
        <p>メニュー: {sp.menuName ?? "—"}</p>
        <p>日付: {sp.date ?? "—"}</p>
        <p>
          時間: {sp.startTime ?? "—"} - {sp.endTime ?? "—"}
        </p>
        <p>人数: {sp.peopleCount ?? "—"}名</p>
      </section>

      <div className="flex gap-3">
        <Link
          href="/restaurant-reservation"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] no-underline"
        >
          トップへ戻る
        </Link>
        <Link
          href="/restaurant-reservation/cancel"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--foreground)] no-underline"
        >
          キャンセル確認へ
        </Link>
      </div>
    </main>
  );
}
