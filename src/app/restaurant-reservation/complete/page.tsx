"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ReservationData = {
  menuId: string;
  menuName: string;
  menuPrice: number;
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  people: number;
  name: string;
  phone: string;
  email: string;
  reservationId: string;
  reservationNumber: string;
  paymentMethod: "onsite_cash" | "credit_card";
  paymentStatus: "pending_onsite" | "completed" | "failed" | "refunded" | "cancelled";
  totalAmount: number;
  stripeSessionId?: string;
};

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日（${days[date.getDay()]}）`;
}

function formatPhone(digits: string): string {
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ja-JP") + "円";
}

function CancelDialog({
  reservation,
  onConfirm,
  onClose,
  cancelling,
}: {
  reservation: ReservationData;
  onConfirm: () => void;
  onClose: () => void;
  cancelling: boolean;
}) {
  const isCreditCard = reservation.paymentMethod === "credit_card";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--foreground)]">予約をキャンセルしますか？</h2>
        <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          {isCreditCard ? (
            <>
              <p>この予約をキャンセルすると、決済した金額（{formatPrice(reservation.totalAmount)}）が全額返金されます。</p>
              <p className="text-xs">返金処理には3〜10営業日かかります。</p>
            </>
          ) : (
            <p>この予約をキャンセルします。</p>
          )}
          <p className="font-medium text-[var(--foreground)]">本当にキャンセルしますか？</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {cancelling ? "処理中..." : "キャンセルする"}
          </button>
          <button
            onClick={onClose}
            disabled={cancelling}
            className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompletePage() {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("reservationData");
    if (!raw) {
      router.replace("/restaurant-reservation");
      return;
    }
    try {
      setReservation(JSON.parse(raw) as ReservationData);
    } catch {
      router.replace("/restaurant-reservation");
    }
  }, [router]);

  const handleCancel = async () => {
    if (!reservation) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch("/api/cancel-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.reservationId,
          reservationNumber: reservation.reservationNumber,
          paymentMethod: reservation.paymentMethod,
          stripeSessionId: reservation.stripeSessionId,
          totalAmount: reservation.totalAmount,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string; refundId?: string };
      setCancelling(false);
      if (!data.success) {
        setCancelError(data.error ?? "キャンセル処理に失敗しました。");
        setShowCancelDialog(false);
        return;
      }
      // キャンセル完了データを保存
      sessionStorage.setItem(
        "cancelledReservationData",
        JSON.stringify({
          ...reservation,
          stripeRefundId: data.refundId,
        })
      );
      sessionStorage.removeItem("reservationData");
      router.push("/restaurant-reservation/cancelled");
    } catch {
      setCancelling(false);
      setCancelError("キャンセル処理でエラーが発生しました。");
      setShowCancelDialog(false);
    }
  };

  if (!reservation) {
    return (
      <main className="p-6">
        <p className="text-[var(--muted)]">読み込み中...</p>
      </main>
    );
  }

  const isCreditCard = reservation.paymentMethod === "credit_card";

  return (
    <main className="space-y-6">
      {showCancelDialog && (
        <CancelDialog
          reservation={reservation}
          onConfirm={handleCancel}
          onClose={() => setShowCancelDialog(false)}
          cancelling={cancelling}
        />
      )}

      {/* ヘッダー */}
      <section className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white text-lg font-bold">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">ご予約ありがとうございます</h1>
            <p className="mt-0.5 text-sm text-green-700 dark:text-green-300">
              ご予約が完了しました。予約内容の確認メールをお送りしました。
            </p>
          </div>
        </div>
      </section>

      {/* 予約内容 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">ご予約内容</h2>
        <dl className="grid gap-2.5 text-sm">
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">予約番号</dt>
            <dd className="font-mono font-semibold text-[var(--foreground)]">{reservation.reservationNumber}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">コース</dt>
            <dd className="font-medium text-[var(--foreground)]">{reservation.menuName}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">日時</dt>
            <dd className="font-medium text-[var(--foreground)]">
              {formatDate(reservation.date)}{" "}
              {reservation.startTime ?? reservation.time}
              {reservation.endTime ? ` - ${reservation.endTime}` : ""}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">人数</dt>
            <dd className="font-medium text-[var(--foreground)]">{reservation.people}名</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">お名前</dt>
            <dd className="font-medium text-[var(--foreground)]">{reservation.name}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">電話番号</dt>
            <dd className="font-medium text-[var(--foreground)]">{formatPhone(reservation.phone)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-[var(--foreground)]">合計金額</dt>
            <dd className="text-lg font-bold text-[var(--primary)]">
              {formatPrice(reservation.menuPrice)} × {reservation.people}名 = {formatPrice(reservation.totalAmount)}
              <span className="ml-1 text-xs font-normal text-[var(--muted)]">（税込）</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* 支払い方法 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">お支払い方法</h2>
        {isCreditCard ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">
              ✓
            </span>
            <div>
              <p className="font-semibold text-[var(--foreground)]">クレジットカード（事前決済済み）</p>
              <p className="mt-0.5 text-sm text-green-600 dark:text-green-400">決済完了</p>
              {reservation.stripeSessionId?.startsWith("demo_") && (
                <p className="mt-1 text-xs text-[var(--muted)]">※ テストモード（実際の課金は発生していません）</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-[var(--foreground)]">来店時に現金でお支払いください</p>
            <p className="mt-1 text-sm text-[var(--muted)]">事前決済は不要です。当日フロントにてお支払いください。</p>
          </div>
        )}
      </section>

      {/* ご来店案内 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-2 text-base font-semibold text-[var(--foreground)]">ご来店をお待ちしております</h2>
        <p className="text-sm text-[var(--muted)]">
          当日はご予約時間の5分前までにご来店ください。
        </p>
      </section>

      {cancelError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {cancelError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/restaurant-reservation"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] no-underline hover:opacity-90"
        >
          トップページに戻る
        </Link>
        <button
          type="button"
          onClick={() => setShowCancelDialog(true)}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-red-300 px-6 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          予約をキャンセルする
        </button>
      </div>
    </main>
  );
}
