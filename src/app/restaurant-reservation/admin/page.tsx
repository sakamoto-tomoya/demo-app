"use client";

import { useEffect, useState } from "react";
import {
  fetchRestaurantNotifications,
  fetchRestaurantReservations,
  runRestaurantReminders,
  updateRestaurantReservationStatus,
} from "@/lib/restaurant-client";
import type { RestaurantNotification } from "@/lib/restaurant-types";
import type { RestaurantReservation } from "@/lib/restaurant-types";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function RestaurantAdminPage() {
  const [date, setDate] = useState(todayYmd);
  const [rows, setRows] = useState<RestaurantReservation[]>([]);
  const [notifications, setNotifications] = useState<RestaurantNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const list = await fetchRestaurantReservations({ date });
    const logs = await fetchRestaurantNotifications(100);
    setRows(list);
    setNotifications(logs);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">予約一覧（管理）</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">日付別に予約状況を確認できます。</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-[var(--muted)]">
            日付
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            {loading ? "読み込み中..." : "再読み込み"}
          </button>
          <button
            type="button"
            onClick={() =>
              void (async () => {
                setMessage("");
                const res = await runRestaurantReminders();
                setMessage(
                  res.ok
                    ? `リマインド実行完了: 対象 ${res.targets ?? 0} 件 / 送信処理 ${res.sent ?? 0} 件`
                    : res.error ?? "リマインド実行に失敗しました。"
                );
              })()
            }
            className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
          >
            リマインド通知を実行
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-[var(--foreground)]">{message}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--border)]/40">
                <th className="border border-[var(--border)] px-2 py-1 text-left">時間</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">予約番号</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">顧客名</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">人数</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">メニュー</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">状態</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border border-[var(--border)] px-2 py-1">{r.startTime} - {r.endTime}</td>
                  <td className="border border-[var(--border)] px-2 py-1 font-mono text-xs">{r.reservationNumber}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{r.customerName}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{r.peopleCount}名</td>
                  <td className="border border-[var(--border)] px-2 py-1">{r.menuName}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{r.status}</td>
                  <td className="border border-[var(--border)] px-2 py-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            const res = await updateRestaurantReservationStatus({ id: r.id, status: "visited" });
                            setMessage(res.ok ? "来店済みに更新しました。" : res.error ?? "更新失敗");
                            await load();
                          })()
                        }
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        来店済み
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            const res = await updateRestaurantReservationStatus({ id: r.id, status: "no_show" });
                            setMessage(res.ok ? "無断キャンセルに更新しました。" : res.error ?? "更新失敗");
                            await load();
                          })()
                        }
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        無断キャンセル
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="border border-[var(--border)] px-2 py-6 text-center text-[var(--muted)]" colSpan={7}>
                    予約がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">通知履歴</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--border)]/40">
                <th className="border border-[var(--border)] px-2 py-1 text-left">作成日時</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">予約ID</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">種別</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">チャネル</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">状態</th>
                <th className="border border-[var(--border)] px-2 py-1 text-left">エラー</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td className="border border-[var(--border)] px-2 py-1">{n.createdAt.replace("T", " ").slice(0, 16)}</td>
                  <td className="border border-[var(--border)] px-2 py-1 font-mono text-xs">{n.reservationId.slice(0, 8)}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{n.notificationType}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{n.channel}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{n.status}</td>
                  <td className="border border-[var(--border)] px-2 py-1">{n.errorMessage ?? "—"}</td>
                </tr>
              ))}
              {notifications.length === 0 && (
                <tr>
                  <td className="border border-[var(--border)] px-2 py-6 text-center text-[var(--muted)]" colSpan={6}>
                    通知履歴がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
