"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import { getAllCases, shouldAlert, deleteCase } from "@/lib/store";
import { CASE_STATUS_LABELS, getStatusLabel, type CaseStatus, type CaseRecord } from "@/lib/types";
import { ALERT_DAYS_THRESHOLD } from "@/lib/types";
import MapView from "@/components/MapView";

const STATUS_ORDER: CaseStatus[] = [
  "new",
  "parts_order",
  "estimate",
  "waiting_contact",
  "no_contact",
  "visit_confirmed",
  "contact_only",
  "sns_sent",
  "completed",
  "cancelled",
];

/** 住所を「川崎市多摩区 枡形」までに短縮（カレンダー表示用） */
function formatAddressShort(address: string | undefined): string {
  if (!address?.trim()) return "";
  const s = address.replace(/^神奈川県\s*/, "").trim();
  const idx = s.indexOf("枡形");
  return idx >= 0 ? s.slice(0, idx + 2) : s;
}

function formatVisitDate(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  try {
    return format(parseISO(raw), "yyyy/MM/dd", { locale: ja });
  } catch {
    return raw;
  }
}

function formatConfirmedTime(c: CaseRecord): string {
  if (c.visitTimeMorningContact) return "当日朝連絡";
  const s = (c.visitTimeStart ?? "").trim();
  const e = (c.visitTimeEnd ?? "").trim();
  if (s && e) return `${s}～${e}`;
  if (s) return s;
  if (e) return e;
  return "未設定";
}

type Props = {
  statusFilter: CaseStatus | null;
  /** 担当者で絞り込み（指定時は assignedTo が一致する案件のみ表示） */
  assigneeFilter?: string | null;
  /** URLクエリから渡す選択日（yyyy-MM-dd） */
  selectedDateFromQuery?: string | null;
};

function normalizeAssigneeName(v: string | undefined | null): string {
  return (v ?? "").replace(/\s+/g, "").trim();
}

function CaseRow({
  c,
  onDelete,
}: {
  c: CaseRecord;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--border)]/50">
      <Link
        href={`/cases/${c.id}/edit`}
        className={`flex-1 min-w-0 no-underline text-[var(--foreground)] hover:opacity-80 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 rounded ${
          shouldAlert(c)
            ? "border-l-4 border-[var(--alert)] bg-[var(--alert-bg)] pl-2 -ml-2"
            : ""
        }`}
        title={
          shouldAlert(c)
            ? `登録から${ALERT_DAYS_THRESHOLD}日以上経過`
            : "クリックで追加入力"
        }
      >
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-2">
          <div className="grid grid-cols-2 gap-x-3 text-[10px] font-medium text-[var(--muted)] sm:grid-cols-4">
            <p>受付番号</p>
            <p>現在のステータス</p>
            <p>型式</p>
            <p>担当者</p>
            <p>訪問先住所</p>
            <p>登録日</p>
            <p>訪問日</p>
            <p>更新日</p>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-[var(--foreground)] sm:grid-cols-4">
            <p>{c.receptionNo || "(番号なし)"}</p>
            <p>{getStatusLabel(c.status)}</p>
            <p>
              {(c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName)
                ? `${c.modelName} / ${c.reportedModelName}`
                : (c.modelName || c.reportedModelName || "未入力")}
            </p>
            <p>{c.assignedTo?.trim() || "未割当"}</p>
            <p>{formatAddressShort(c.address) || "未入力"}</p>
            <p>{format(parseISO(c.createdAt), "yyyy/MM/dd", { locale: ja })}</p>
            <p>{c.visitDate ? formatVisitDate(c.visitDate) : "未設定"}</p>
            <p>{format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja })}</p>
          </div>
          {c.visitTimeMorningContact ? (
            <p className="mt-1 text-xs text-[var(--muted)]">連絡時間: 当日朝連絡</p>
          ) : (c.contactAttemptTimes?.length ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">連絡時間: {c.contactAttemptTimes!.join(", ")}</p>
          ) : (c.visitTimeStart || c.visitTimeEnd) ? (
            <p className="mt-1 text-xs text-[var(--muted)]">連絡時間: {[c.visitTimeStart || "--", c.visitTimeEnd || "--"].join("～")}</p>
          ) : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (confirm("この案件を削除しますか？")) onDelete();
        }}
        title="削除"
        className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-red-100 hover:text-red-600"
        aria-label="削除"
      >
        ×
      </button>
    </li>
  );
}

export default function CalendarView({ statusFilter, assigneeFilter, selectedDateFromQuery }: Props) {
  const [current, setCurrent] = useState(() => new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  /** クリックして詳細表示する日付（yyyy-MM-dd） */
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  /** 地図で現在選択中の案件ID（対応する一覧行を強調表示する） */
  const [activeMapCaseId, setActiveMapCaseId] = useState<string | null>(null);
  /** 地図表示は訪問日確定のみ（一覧は履歴として残す） */
  const mapOnlyStatusFilter: CaseStatus = "visit_confirmed";

  useEffect(() => {
    const d = (selectedDateFromQuery ?? "").trim();
    if (!d) return;
    setSelectedDateKey(d);
    try {
      setCurrent(parseISO(d));
    } catch {
      // ignore
    }
  }, [selectedDateFromQuery]);

  const reloadCases = useCallback(() => {
    void getAllCases().then(setCases);
  }, []);

  useEffect(() => {
    reloadCases();
  }, [refreshKey, reloadCases]);

  useEffect(() => {
    if (!activeMapCaseId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-map-case-row="${CSS.escape(activeMapCaseId)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeMapCaseId, selectedDateKey, statusFilter, assigneeFilter, cases]);

  // 他画面で更新したあとに戻ってきたとき、最新状態を反映する
  useEffect(() => {
    const onFocus = () => reloadCases();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reloadCases();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reloadCases]);

  const assigneeCases = useMemo(() => {
    if (!assigneeFilter) return cases;
    const filterKey = normalizeAssigneeName(assigneeFilter);
    return cases.filter((c) => normalizeAssigneeName(c.assignedTo) === filterKey);
  }, [cases, assigneeFilter]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<CaseStatus, number>;
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const c of assigneeCases) {
      if (c.status in counts) counts[c.status as CaseStatus]++;
    }
    return counts;
  }, [assigneeCases]);

  const casesByDate = useMemo(() => {
    const map = new Map<string, typeof cases>();
    const filterKey = normalizeAssigneeName(assigneeFilter);
    for (const c of cases) {
      if (statusFilter && c.status !== statusFilter) continue;
      if (assigneeFilter && normalizeAssigneeName(c.assignedTo) !== filterKey) continue;
      const key = c.visitDate
        ? format(parseISO(c.visitDate), "yyyy-MM-dd")
        : format(parseISO(c.createdAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [cases, statusFilter, assigneeFilter]);

  const allCasesByDate = useMemo(() => {
    const map = new Map<string, typeof cases>();
    const filterKey = normalizeAssigneeName(assigneeFilter);
    for (const c of cases) {
      if (assigneeFilter && normalizeAssigneeName(c.assignedTo) !== filterKey) continue;
      const key = c.visitDate
        ? format(parseISO(c.visitDate), "yyyy-MM-dd")
        : format(parseISO(c.createdAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [cases, assigneeFilter]);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrent((c) => subMonths(c, 1))}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)]"
          >
            前月
          </button>
          <span className="min-w-[180px] text-center text-lg font-semibold">
            {format(current, "yyyy年M月", { locale: ja })}
          </span>
          <button
            type="button"
            onClick={() => setCurrent((c) => addMonths(c, 1))}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)]"
          >
            次月
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          {assigneeFilter && (
            <>
              <span>担当者: {assigneeFilter}</span>
              <Link
                href="/calendar"
                className="text-[var(--primary)] hover:underline"
              >
                担当者を変更
              </Link>
            </>
          )}
          {statusFilter && (
            <span>フィルター: {CASE_STATUS_LABELS[statusFilter]}</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse">
          <thead>
            <tr>
              {weekDays.map((w) => (
                <th
                  key={w}
                  className="border border-[var(--border)] bg-[var(--card)] py-2 text-center text-xs font-medium text-[var(--muted)]"
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => (
              <tr key={i}>
                {days.slice(i * 7, i * 7 + 7).map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayCases = casesByDate.get(key) ?? [];
                  const inMonth = isSameMonth(day, current);
                  const isSelected = selectedDateKey === key;
                  return (
                    <td
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDateKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDateKey(key);
                        }
                      }}
                      className={`min-h-[60px] border border-[var(--border)] p-1 align-top cursor-pointer sm:min-h-[70px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset ${
                        inMonth ? "bg-[var(--card)]" : "bg-[var(--background)] text-[var(--muted)]"
                      } ${isSelected ? "ring-2 ring-[var(--primary)]" : ""} hover:bg-[var(--border)]/30`}
                    >
                      <span className="text-sm font-medium">{format(day, "d")}</span>
                      {dayCases.length > 0 && (
                        <span className="ml-1 text-xs text-[var(--muted)]">
                          {dayCases.length}件
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDateKey && (() => {
        const dayCases = allCasesByDate.get(selectedDateKey) ?? [];
        const d = parseISO(selectedDateKey);
        return (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--foreground)]">
              {format(d, "yyyy年M月d日", { locale: ja })}
            </h3>
            {dayCases.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">予定はありません</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--border)]/40">
                        <th className="border border-[var(--border)] px-2 py-1 text-left">受付番号</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">現在のステータス</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">型式</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">担当者</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">訪問先住所</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">登録日</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">訪問日</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">訪問確定時間</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">更新日</th>
                        <th className="border border-[var(--border)] px-2 py-1 text-left">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayCases.map((c) => (
                        <tr
                          key={c.id}
                          data-map-case-row={c.id}
                          className={`hover:bg-[var(--border)]/20 ${activeMapCaseId === c.id ? "map-active-case-row" : ""}`}
                        >
                          <td className="border border-[var(--border)] px-2 py-1">{c.receptionNo || "(番号なし)"}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{getStatusLabel(c.status)}</td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            {(c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName)
                              ? `${c.modelName} / ${c.reportedModelName}`
                              : (c.modelName || c.reportedModelName || "未入力")}
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">{c.assignedTo?.trim() || "未割当"}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{formatAddressShort(c.address) || "未入力"}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{c.visitDate ? formatVisitDate(c.visitDate) : "未設定"}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{formatConfirmedTime(c)}</td>
                          <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <div className="flex items-center gap-2">
                                  <Link
                                    href={`/cases/${c.id}/edit?returnTo=${encodeURIComponent(`/calendar?assignee=${encodeURIComponent(assigneeFilter ?? "")}&status=&selectedDate=${encodeURIComponent(c.visitDate ? format(parseISO(c.visitDate), "yyyy-MM-dd") : format(parseISO(c.createdAt), "yyyy-MM-dd"))}`)}`}
                                    className="text-[var(--primary)] hover:underline"
                                  >
                                詳細
                              </Link>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm("この案件を削除しますか？")) {
                                    await deleteCase(c.id);
                                    setRefreshKey((k) => k + 1);
                                  }
                                }}
                                className="text-[var(--muted)] hover:text-red-600"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-3">
                  <p className="text-sm text-[var(--muted)]">
                    {selectedDateKey} の予定のみを地図表示しています。
                  </p>
                  <MapView
                    dateFilterOverride={selectedDateKey}
                    assigneeFilter={assigneeFilter ?? null}
                    statusFilter={mapOnlyStatusFilter}
                    onActiveCaseChange={setActiveMapCaseId}
                  />
                </div>
              </>
            )}
          </div>
        );
      })()}

      {assigneeFilter && !selectedDateKey && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--foreground)]">
            選択中: {assigneeFilter}
          </p>
          <div className="grid grid-cols-5 gap-3">
            {STATUS_ORDER.map((status) => {
              const href = `/calendar?assignee=${encodeURIComponent(assigneeFilter)}&status=${status}`;
              return (
                <Link
                  key={status}
                  href={href}
                  className={`rounded-xl border p-4 shadow-sm transition hover:shadow outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
                    statusFilter === status
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"
                  }`}
                >
                  <p className="text-xs text-[var(--muted)]">
                    {CASE_STATUS_LABELS[status]}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {statusCounts[status]}
                  </p>
                  <span className="text-xs text-[var(--muted)]">件</span>
                </Link>
              );
            })}
          </div>
          {statusFilter && (() => {
            const detailCases = assigneeCases.filter((c) => c.status === statusFilter);
            return (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 text-base font-semibold text-[var(--foreground)]">
                  {CASE_STATUS_LABELS[statusFilter]}の案件（{detailCases.length}件）
                </h3>
                {detailCases.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">該当する案件はありません</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-[var(--border)]/40">
                            <th className="border border-[var(--border)] px-2 py-1 text-left">受付番号</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">現在のステータス</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">型式</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">担当者</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">訪問先住所</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">登録日</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">訪問日</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">訪問確定時間</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">更新日</th>
                            <th className="border border-[var(--border)] px-2 py-1 text-left">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailCases.map((c) => (
                            <tr
                              key={c.id}
                              data-map-case-row={c.id}
                              className={`hover:bg-[var(--border)]/20 ${activeMapCaseId === c.id ? "map-active-case-row" : ""}`}
                            >
                              <td className="border border-[var(--border)] px-2 py-1">{c.receptionNo || "(番号なし)"}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{getStatusLabel(c.status)}</td>
                              <td className="border border-[var(--border)] px-2 py-1">
                                {(c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName)
                                  ? `${c.modelName} / ${c.reportedModelName}`
                                  : (c.modelName || c.reportedModelName || "未入力")}
                              </td>
                              <td className="border border-[var(--border)] px-2 py-1">{c.assignedTo?.trim() || "未割当"}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{formatAddressShort(c.address) || "未入力"}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{c.visitDate ? formatVisitDate(c.visitDate) : "未設定"}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{formatConfirmedTime(c)}</td>
                              <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                              <td className="border border-[var(--border)] px-2 py-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/cases/${c.id}/edit?returnTo=${encodeURIComponent(`/calendar?assignee=${encodeURIComponent(assigneeFilter ?? "")}&status=${encodeURIComponent(statusFilter ?? "")}&selectedDate=${encodeURIComponent(selectedDateKey ?? "")}`)}`}
                                    className="text-[var(--primary)] hover:underline"
                                  >
                                    詳細
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm("この案件を削除しますか？")) {
                                        await deleteCase(c.id);
                                        setRefreshKey((k) => k + 1);
                                      }
                                    }}
                                    className="text-[var(--muted)] hover:text-red-600"
                                  >
                                    削除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[var(--border)]">
                      <Link
                        href={`/map?date=${format(parseISO(detailCases[0].visitDate || detailCases[0].createdAt), "yyyy-MM-dd")}`}
                        className="inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
                      >
                        地図ルートを確認
                      </Link>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
          凡例
        </h3>
        <p className="text-xs text-[var(--muted)]">
          左に<strong className="text-[var(--alert)]">赤線</strong>
          が付いている案件は、登録日から{ALERT_DAYS_THRESHOLD}
          日以上経過した「要対応」案件です。
        </p>
      </div>
    </div>
  );
}
