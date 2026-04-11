"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAvailability, fetchRestaurantMenus } from "@/lib/restaurant-client";
import { DateInput } from "@/components/DateInput";
import type { RestaurantMenu } from "@/lib/restaurant-types";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function AvailabilityPage() {
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [menuId, setMenuId] = useState("");
  const [peopleCount, setPeopleCount] = useState(2);
  const [date, setDate] = useState(todayYmd);
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string; remainingSeats: number }>>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await fetchRestaurantMenus();
      setMenus(list);
      if (list[0]) setMenuId(list[0].id);
    })();
  }, []);

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

  const search = async () => {
    if (!menuId) return;
    setLoading(true);
    setMessage("");
    const res = await fetchAvailability({ date, menuId, peopleCount });
    setSlots(res.slots);
    setMessage(res.reason ?? (res.slots.length === 0 ? "空き枠がありません。" : ""));
    setLoading(false);
  };

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">空き日時確認</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          メニュー・人数・日付を選んで、空き枠を検索できます。
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="grid gap-4 md:grid-cols-3">
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
            日付
            <DateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void search()}
            disabled={!menuId || loading}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
          >
            {loading ? "検索中..." : "空き枠を検索"}
          </button>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-[var(--foreground)]">
            予約可能時間{selectedMenu ? `（${selectedMenu.name}）` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Link
                key={`${slot.startTime}-${slot.endTime}`}
                href={`/restaurant-reservation/new?menuId=${encodeURIComponent(menuId)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(slot.startTime)}&people=${peopleCount}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
              >
                {slot.startTime} - {slot.endTime}（残{slot.remainingSeats}席）
              </Link>
            ))}
            {!loading && slots.length === 0 && <p className="text-sm text-[var(--muted)]">{message || "条件を入力して検索してください。"}</p>}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/restaurant-reservation/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] no-underline"
          >
            この条件で予約へ進む
          </Link>
          <Link
            href="/restaurant-reservation"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--foreground)] no-underline"
          >
            戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
