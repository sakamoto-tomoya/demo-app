"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAvailability, fetchRestaurantMenus } from "@/lib/restaurant-client";
import type { RestaurantMenu } from "@/lib/restaurant-types";
import { DateInput } from "@/components/DateInput";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function maxDateYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ja-JP") + "円";
}

function CancelDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--foreground)]">予約をキャンセルしますか？</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          入力内容は保存されません。
        </p>
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

function BookingPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<RestaurantMenu | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState("");
  const [people, setPeople] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [error, setError] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const menuId = sp.get("menuId") ?? "";

  useEffect(() => {
    void (async () => {
      const list = await fetchRestaurantMenus();
      setMenus(list);
      const found = list.find((m) => m.id === menuId) ?? list[0] ?? null;
      setSelectedMenu(found);
      if (found) {
        const lo = Math.max(1, found.minPeople);
        setPeople(Math.min(Math.max(2, lo), found.maxPeople));
      }
    })();
  }, [menuId]);

  useEffect(() => {
    if (!selectedMenu || !date || !people) return;
    setLoadingTimes(true);
    void (async () => {
      const res = await fetchAvailability({ menuId: selectedMenu.id, date, peopleCount: people });
      setAvailableTimes(res.slots.map((s) => s.startTime));
      setTime("");
      setLoadingTimes(false);
    })();
  }, [selectedMenu, date, people]);

  const peopleOptions = useMemo(() => {
    if (!selectedMenu) return Array.from({ length: 10 }, (_, i) => i + 1);
    const lo = Math.max(1, selectedMenu.minPeople);
    const hi = Math.min(10, selectedMenu.maxPeople);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [selectedMenu]);

  const handleNext = () => {
    setError("");
    if (!selectedMenu) { setError("メニューが見つかりません。"); return; }
    if (!date) { setError("すべての項目を入力してください。"); return; }
    if (!time) { setError("希望時間を選択してください。"); return; }
    if (!name.trim()) { setError("すべての項目を入力してください。"); return; }

    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("電話番号を正しく入力してください（10〜11桁）。");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("メールアドレスを正しく入力してください。");
      return;
    }

    const data = {
      menuId: selectedMenu.id,
      menuName: selectedMenu.name,
      menuPrice: selectedMenu.price,
      durationMinutes: selectedMenu.durationMinutes,
      date,
      time,
      people,
      name: name.trim(),
      phone: phoneDigits,
      email: email.trim().toLowerCase(),
    };
    sessionStorage.setItem("bookingData", JSON.stringify(data));
    router.push("/restaurant-reservation/payment");
  };

  return (
    <main className="space-y-6">
      {showCancelDialog && (
        <CancelDialog
          onConfirm={() => router.push("/restaurant-reservation")}
          onClose={() => setShowCancelDialog(false)}
        />
      )}

      {/* ヘッダー */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">予約情報入力</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ご希望の日時・人数・お客様情報を入力してください。</p>
      </section>

      {/* 選択コース */}
      {selectedMenu && (
        <section className="rounded-2xl border border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">選択したコース</p>
          <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
            {selectedMenu.name}
            <span className="ml-2 text-base font-medium text-[var(--primary)]">
              {formatPrice(selectedMenu.price)} / 1名
            </span>
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selectedMenu.description}　所要時間: {selectedMenu.durationMinutes}分
          </p>
        </section>
      )}

      {/* フォーム */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">ご予約情報をご入力ください</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {/* 希望日 */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">
            希望日 <span className="text-red-500">*</span>
            <DateInput
              value={date}
              min={todayYmd()}
              max={maxDateYmd()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]"
            />
          </label>

          {/* 人数 */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">
            人数 <span className="text-red-500">*</span>
            <select
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]"
            >
              {peopleOptions.map((n) => (
                <option key={n} value={n}>{n}名</option>
              ))}
            </select>
          </label>

          {/* 希望時間 */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)] md:col-span-2">
            希望時間 <span className="text-red-500">*</span>
            {loadingTimes ? (
              <p className="text-sm text-[var(--muted)]">空き時間を確認中...</p>
            ) : availableTimes.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--muted)]">
                この日の空き枠はありません
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      time === t
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </label>

          {/* 氏名 */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)] md:col-span-2">
            お名前 <span className="text-red-500">*</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)]"
            />
          </label>

          {/* 電話番号 */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">
            電話番号 <span className="text-red-500">*</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09012345678（ハイフンなし）"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)]"
            />
          </label>

          {/* メール */}
          <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">
            メールアドレス <span className="text-red-500">*</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)]"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60"
          >
            次へ進む →
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

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6">
          <p className="text-[var(--muted)]">読み込み中...</p>
        </main>
      }
    >
      <BookingPageInner />
    </Suspense>
  );
}
