 "use client";

import Link from "next/link";
import { useState } from "react";
import { cancelRestaurantReservation } from "@/lib/restaurant-client";

export default function CancelReservationPage() {
  const [reservationNumber, setReservationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setLoading(true);
    setMessage("");
    const res = await cancelRestaurantReservation({ reservationNumber, email, reason });
    setLoading(false);
    setMessage(res.ok ? "キャンセル処理が完了しました。" : res.error ?? "キャンセル処理に失敗しました。");
  };

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">キャンセル確認</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          予約番号と連絡先で対象予約を確認してキャンセルするための画面です。
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            予約番号
            <input
              value={reservationNumber}
              onChange={(e) => setReservationNumber(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              placeholder="例: RSV-20260324-001"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              placeholder="sample@example.com"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)] md:col-span-2">
            キャンセル理由（任意）
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "処理中..." : "キャンセルを実行"}
            </button>
            <Link
              href="/restaurant-reservation"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--foreground)] no-underline"
            >
              戻る
            </Link>
          </div>
          {message && <p className="md:col-span-2 text-sm text-[var(--foreground)]">{message}</p>}
        </form>
      </section>
    </main>
  );
}
