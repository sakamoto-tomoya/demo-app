"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CancelledData = {
  menuName: string;
  date: string;
  time: string;
  startTime?: string;
  people: number;
  reservationNumber: string;
  paymentMethod: "onsite_cash" | "credit_card";
  totalAmount: number;
  stripeRefundId?: string;
};

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日（${days[date.getDay()]}）`;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ja-JP") + "円";
}

export default function CancelledPage() {
  const router = useRouter();
  const [data, setData] = useState<CancelledData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("cancelledReservationData");
    if (!raw) {
      router.replace("/restaurant-reservation");
      return;
    }
    try {
      setData(JSON.parse(raw) as CancelledData);
    } catch {
      router.replace("/restaurant-reservation");
    }
  }, [router]);

  if (!data) {
    return (
      <main className="p-6">
        <p className="text-[var(--muted)]">読み込み中...</p>
      </main>
    );
  }

  const isCreditCard = data.paymentMethod === "credit_card";

  return (
    <main className="space-y-6">
      {/* ヘッダー */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">予約をキャンセルしました</h1>
      </section>

      {/* キャンセルした予約 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">キャンセルした予約</h2>
        <dl className="grid gap-2.5 text-sm">
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">予約番号</dt>
            <dd className="font-mono font-semibold text-[var(--foreground)]">{data.reservationNumber}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">コース</dt>
            <dd className="font-medium text-[var(--foreground)]">{data.menuName}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">日時</dt>
            <dd className="font-medium text-[var(--foreground)]">
              {formatDate(data.date)} {data.startTime ?? data.time}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">人数</dt>
            <dd className="font-medium text-[var(--foreground)]">{data.people}名</dd>
          </div>
          {isCreditCard && (
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">決済金額</dt>
              <dd className="font-semibold text-[var(--foreground)]">{formatPrice(data.totalAmount)}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* 返金情報 */}
      {isCreditCard && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950">
          <h2 className="mb-3 text-base font-semibold text-blue-800 dark:text-blue-200">返金について</h2>
          <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
            <p>
              決済した金額（{formatPrice(data.totalAmount)}）は全額返金されます。
            </p>
            <p>返金処理には3〜10営業日かかります。</p>
            <p className="text-xs">
              クレジットカードの明細に反映されるまでお時間をいただく場合がございます。
            </p>
            {data.stripeRefundId && !data.stripeRefundId.startsWith("demo_") && (
              <p className="font-mono text-xs text-blue-600 dark:text-blue-400">
                返金ID: {data.stripeRefundId}
              </p>
            )}
            {data.stripeRefundId?.startsWith("demo_") && (
              <p className="text-xs text-blue-500 dark:text-blue-400">
                ※ テストモード（実際の返金処理はスキップされました）
              </p>
            )}
          </div>
        </section>
      )}

      {/* 確認メール */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <p className="text-sm text-[var(--muted)]">キャンセル確認メールをお送りしました。</p>
      </section>

      <div>
        <Link
          href="/restaurant-reservation"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] no-underline hover:opacity-90"
        >
          トップページに戻る
        </Link>
      </div>
    </main>
  );
}
