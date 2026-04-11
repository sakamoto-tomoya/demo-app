"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createRestaurantReservation, fetchAvailability, fetchRestaurantMenus } from "@/lib/restaurant-client";
import { DateInput } from "@/components/DateInput";
import type { RestaurantMenu } from "@/lib/restaurant-types";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function NewReservationPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [menuId, setMenuId] = useState("");
  const [peopleCount, setPeopleCount] = useState(() => {
    const p = Number(sp.get("people") || "2");
    return Math.min(5, Math.max(1, Math.round(p)));
  });
  const [date, setDate] = useState(sp.get("date") || todayYmd());
  const [startTime, setStartTime] = useState(sp.get("time") || "");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");

  const selectedMenu = useMemo(() => menus.find((m) => m.id === menuId) ?? null, [menus, menuId]);

  const peopleOptions = useMemo(() => {
    if (!selectedMenu) return [1, 2, 3, 4, 5];
    const lo = Math.max(1, selectedMenu.minPeople);
    const hi = Math.min(5, selectedMenu.maxPeople);
    if (lo > hi) return [lo];
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [selectedMenu]);

  useEffect(() => {
    if (!selectedMenu) return;
    const lo = Math.max(1, selectedMenu.minPeople);
    const hi = Math.min(5, selectedMenu.maxPeople);
    setPeopleCount((prev) => (prev >= lo && prev <= hi ? prev : lo));
  }, [selectedMenu]);

  useEffect(() => {
    void (async () => {
      const list = await fetchRestaurantMenus();
      setMenus(list);
      const menuFromQuery = sp.get("menuId");
      if (menuFromQuery && list.some((m) => m.id === menuFromQuery)) {
        setMenuId(menuFromQuery);
      } else if (list[0]) {
        setMenuId(list[0].id);
      }
    })();
  }, [sp]);

  useEffect(() => {
    if (!menuId || !date || !peopleCount || !selectedMenu) return;
    const lo = Math.max(1, selectedMenu.minPeople);
    const hi = Math.min(5, selectedMenu.maxPeople);
    if (peopleCount < lo || peopleCount > hi) return;
    void (async () => {
      const res = await fetchAvailability({ menuId, date, peopleCount });
      setAvailableTimes(res.slots.map((s) => s.startTime));
      if (startTime && !res.slots.some((s) => s.startTime === startTime)) {
        setStartTime("");
      }
    })();
  }, [menuId, date, peopleCount, startTime, selectedMenu]);

  const submit = async () => {
    if (!menuId || !date || !startTime || !customerName || !phone || !email) {
      setResult("必須項目を入力してください。");
      return;
    }
    setSubmitting(true);
    const res = await createRestaurantReservation({
      menuId,
      date,
      startTime,
      peopleCount,
      customerName,
      phone,
      email,
      note,
    });
    setSubmitting(false);
    if (!res.ok || !res.reservation) {
      setResult(res.error ?? "予約作成に失敗しました。");
      return;
    }
    setResult(`予約が完了しました。予約番号: ${res.reservation.reservationNumber}`);
    const q = new URLSearchParams({
      reservationNumber: res.reservation.reservationNumber,
      menuName: res.reservation.menuName,
      date: res.reservation.reservationDate,
      startTime: res.reservation.startTime,
      endTime: res.reservation.endTime,
      peopleCount: String(res.reservation.peopleCount),
    });
    router.push(`/restaurant-reservation/complete?${q.toString()}`);
  };

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">予約作成</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">空き枠ルールを使って予約を登録します。</p>
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
            メニュー
            <select
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.durationMinutes}分）
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            人数
            <select
              value={peopleCount}
              onChange={(e) => setPeopleCount(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              {peopleOptions.map((n) => (
                <option key={n} value={n}>
                  {n}名
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            予約日
            <DateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            予約時間
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">選択してください</option>
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)] md:col-span-2">
            氏名
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              placeholder="山田 太郎"
            />
          </label>
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            電話番号
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              placeholder="09012345678"
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
            備考
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              placeholder="アレルギーなど（任意）"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting || !selectedMenu}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {submitting ? "予約中..." : "予約を確定"}
            </button>
            <Link
              href="/restaurant-reservation"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--foreground)] no-underline"
            >
              戻る
            </Link>
          </div>
          {result && <p className="md:col-span-2 text-sm text-[var(--foreground)]">{result}</p>}
        </form>
      </section>
    </main>
  );
}

export default function NewReservationPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6">
          <p className="text-[var(--muted)]">読み込み中…</p>
        </main>
      }
    >
      <NewReservationPageInner />
    </Suspense>
  );
}
