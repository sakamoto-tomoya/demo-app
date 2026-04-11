"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRestaurantReservation } from "@/lib/restaurant-client";

type BookingData = {
  menuId: string;
  menuName: string;
  menuPrice: number;
  durationMinutes: number;
  date: string;
  time: string;
  people: number;
  name: string;
  phone: string;
  email: string;
};

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日（${days[date.getDay()]}）`;
}

function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ja-JP") + "円";
}

function CancelDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--foreground)]">予約をキャンセルしますか？</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">入力内容は保存されません。</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            キャンセルする
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
          >
            続ける
          </button>
        </div>
      </div>
    </div>
  );
}

const isDemoMode =
  !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "pk_test_demo";

export default function PaymentPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"onsite_cash" | "credit_card">("onsite_cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("bookingData");
    if (!raw) {
      router.replace("/restaurant-reservation");
      return;
    }
    try {
      setBooking(JSON.parse(raw) as BookingData);
    } catch {
      router.replace("/restaurant-reservation");
    }
  }, [router]);

  if (!booking) {
    return (
      <main className="p-6">
        <p className="text-[var(--muted)]">読み込み中...</p>
      </main>
    );
  }

  const totalAmount = booking.menuPrice * booking.people;

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);

    if (paymentMethod === "onsite_cash") {
      // 現金: そのまま予約作成
      const res = await createRestaurantReservation({
        menuId: booking.menuId,
        date: booking.date,
        startTime: booking.time,
        peopleCount: booking.people,
        customerName: booking.name,
        phone: booking.phone,
        email: booking.email,
      });
      setSubmitting(false);
      if (!res.ok || !res.reservation) {
        setError(res.error ?? "予約作成に失敗しました。もう一度お試しください。");
        return;
      }
      // 予約データをsessionStorageに保存
      sessionStorage.setItem(
        "reservationData",
        JSON.stringify({
          ...booking,
          reservationId: res.reservation.id,
          reservationNumber: res.reservation.reservationNumber,
          startTime: res.reservation.startTime,
          endTime: res.reservation.endTime,
          paymentMethod: "onsite_cash",
          paymentStatus: "pending_onsite",
          totalAmount,
        })
      );
      router.push("/restaurant-reservation/complete");
      return;
    }

    // クレジットカード
    if (isDemoMode) {
      // デモモード: 予約作成してデモ決済を模擬
      const res = await createRestaurantReservation({
        menuId: booking.menuId,
        date: booking.date,
        startTime: booking.time,
        peopleCount: booking.people,
        customerName: booking.name,
        phone: booking.phone,
        email: booking.email,
      });
      setSubmitting(false);
      if (!res.ok || !res.reservation) {
        setError(res.error ?? "予約作成に失敗しました。もう一度お試しください。");
        return;
      }
      sessionStorage.setItem(
        "reservationData",
        JSON.stringify({
          ...booking,
          reservationId: res.reservation.id,
          reservationNumber: res.reservation.reservationNumber,
          startTime: res.reservation.startTime,
          endTime: res.reservation.endTime,
          paymentMethod: "credit_card",
          paymentStatus: "completed",
          totalAmount,
          stripeSessionId: `demo_session_${Date.now()}`,
        })
      );
      router.push("/restaurant-reservation/complete");
      return;
    }

    // 本番Stripe: Checkout Session作成
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId: booking.menuId,
          menuName: booking.name,
          menuPrice: booking.menuPrice,
          people: booking.people,
          date: booking.date,
          time: booking.time,
          customerName: booking.name,
          phone: booking.phone,
          email: booking.email,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      setSubmitting(false);
      if (!data.url) {
        setError(data.error ?? "決済画面への移動に失敗しました。");
        return;
      }
      // Stripeリダイレクト前にbookingデータを保存
      sessionStorage.setItem("pendingBookingForStripe", JSON.stringify({ ...booking, totalAmount }));
      window.location.href = data.url;
    } catch {
      setSubmitting(false);
      setError("決済処理でエラーが発生しました。もう一度お試しください。");
    }
  };

  return (
    <main className="space-y-6">
      {showCancelDialog && (
        <CancelDialog
          onConfirm={() => {
            sessionStorage.removeItem("bookingData");
            router.push("/restaurant-reservation");
          }}
          onClose={() => setShowCancelDialog(false)}
        />
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">お支払い方法を選択</h1>
      </section>

      {/* 予約内容確認 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">ご予約内容の確認</h2>
        <dl className="grid gap-2.5 text-sm">
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">コース</dt>
            <dd className="font-medium text-[var(--foreground)]">{booking.menuName}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">日時</dt>
            <dd className="font-medium text-[var(--foreground)]">
              {formatDate(booking.date)} {booking.time}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">人数</dt>
            <dd className="font-medium text-[var(--foreground)]">{booking.people}名</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">お名前</dt>
            <dd className="font-medium text-[var(--foreground)]">{booking.name}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">電話番号</dt>
            <dd className="font-medium text-[var(--foreground)]">{formatPhone(booking.phone)}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">メール</dt>
            <dd className="font-medium text-[var(--foreground)]">{booking.email}</dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt className="font-semibold text-[var(--foreground)]">合計金額</dt>
            <dd className="text-lg font-bold text-[var(--primary)]">
              {formatPrice(booking.menuPrice)} × {booking.people}名 ={" "}
              <span className="text-xl">{formatPrice(totalAmount)}</span>
              <span className="ml-1 text-xs font-normal text-[var(--muted)]">（税込）</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* 支払い方法選択 */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">お支払い方法を選択してください</h2>
        <div className="grid gap-3">
          {/* 現金 */}
          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              paymentMethod === "onsite_cash"
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))]"
                : "border-[var(--border)] hover:border-[var(--primary)]"
            }`}
          >
            <input
              type="radio"
              name="payment"
              value="onsite_cash"
              checked={paymentMethod === "onsite_cash"}
              onChange={() => setPaymentMethod("onsite_cash")}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div>
              <p className="font-semibold text-[var(--foreground)]">来店時に現金で支払う</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--muted)]">
                <li>・予約確定後、来店時に現金でお支払いください</li>
                <li>・事前決済は不要です</li>
              </ul>
            </div>
          </label>

          {/* クレカ */}
          <label
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors ${
              paymentMethod === "credit_card"
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))]"
                : "border-[var(--border)] hover:border-[var(--primary)]"
            }`}
          >
            <input
              type="radio"
              name="payment"
              value="credit_card"
              checked={paymentMethod === "credit_card"}
              onChange={() => setPaymentMethod("credit_card")}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <div>
              <p className="font-semibold text-[var(--foreground)]">今すぐクレジットカードで事前決済</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--muted)]">
                <li>・予約と同時に決済完了</li>
                <li>・VISA / Mastercard / JCB / AMEX 対応</li>
              </ul>
            </div>
          </label>
        </div>

        {/* テストカード情報 */}
        {paymentMethod === "credit_card" && (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] p-4 text-sm">
            <p className="font-semibold text-[var(--foreground)]">デモ用テストカード番号</p>
            <div className="mt-2 grid gap-1 text-[var(--muted)]">
              <p>カード番号: <span className="font-mono text-[var(--foreground)]">4242 4242 4242 4242</span></p>
              <p>有効期限: <span className="font-mono text-[var(--foreground)]">12/34</span></p>
              <p>CVC: <span className="font-mono text-[var(--foreground)]">123</span></p>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              ※ これはデモ用のテストモードです。実際の課金は発生しません。
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "処理中..." : "予約を確定する"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            キャンセル
          </button>
        </div>
      </section>
    </main>
  );
}
