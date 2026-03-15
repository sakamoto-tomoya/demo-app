"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  getCaseCounts,
  getAllCases,
  getCasesByStatus,
  shouldAlert,
  deleteCase,
} from "@/lib/store";
import { CASE_STATUS_LABELS, getStatusLabel, type CaseStatus } from "@/lib/types";
import type { CaseRecord } from "@/lib/types";
import { ALERT_DAYS_THRESHOLD } from "@/lib/types";

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

const ZERO_COUNTS: Record<CaseStatus, number> = {
  new: 0,
  parts_order: 0,
  estimate: 0,
  waiting_contact: 0,
  no_contact: 0,
  visit_confirmed: 0,
  contact_only: 0,
  sns_sent: 0,
  completed: 0,
  cancelled: 0,
};

function formatAddressShort(address: string | undefined): string {
  if (!address?.trim()) return "";
  const s = address.replace(/^神奈川県\s*/, "").trim();
  const idx = s.indexOf("枡形");
  return idx >= 0 ? s.slice(0, idx + 2) : s;
}

function CaseRow({
  c,
  onDelete,
}: {
  c: CaseRecord;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm hover:bg-[var(--background)]">
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
        {c.receptionNo || "(番号なし)"} — {getStatusLabel(c.status)}
        {(c.modelName || c.reportedModelName) && (
          <> {(c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName)
            ? `${c.modelName} / ${c.reportedModelName}`
            : (c.modelName || c.reportedModelName)}
          </>
        )}
        {c.assignedTo && <> {c.assignedTo}</>}
        {c.visitTimeMorningContact ? (
          <> 当日朝連絡</>
        ) : (c.contactAttemptTimes?.length ?? 0) > 0 ? (
          <> {c.contactAttemptTimes!.join(", ")}</>
        ) : (c.visitTimeStart || c.visitTimeEnd) ? (
          <> {[c.visitTimeStart || "--", c.visitTimeEnd || "--"].join("～")}</>
        ) : null}
        {formatAddressShort(c.address) && (
          <> {formatAddressShort(c.address)}</>
        )}
        <> 更新日 {format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja })}</>
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

export default function StatusCards() {
  const [counts, setCounts] = useState<Record<CaseStatus, number>>(ZERO_COUNTS as Record<CaseStatus, number>);
  const [alertCount, setAlertCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCounts(getCaseCounts());
    setAlertCount(getAllCases().filter(shouldAlert).length);
  }, [refreshKey]);

  const detailCases = selectedStatus ? getCasesByStatus(selectedStatus) : [];

  const handleCardClick = (status: CaseStatus) => {
    setSelectedStatus((prev) => (prev === status ? null : status));
  };

  const handleDelete = (id: string) => {
    deleteCase(id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      {alertCount > 0 && (
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--alert)] bg-[var(--alert-bg)] p-5 shadow-[var(--shadow-sm)]">
          <p className="font-semibold text-[var(--alert)]">
            ⚠ 要対応: 登録から5日以上経過した案件が {alertCount} 件あります
          </p>
          <Link
            href="/calendar"
            className="mt-2 inline-block text-sm font-medium text-[var(--alert)] underline underline-offset-2"
          >
            カレンダーで確認 →
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handleCardClick(status)}
            className={`app-card rounded-[var(--radius-lg)] p-5 text-left transition-all ${
              selectedStatus === status
                ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]"
                : "hover:shadow-[var(--shadow)]"
            }`}
          >
            <p className="text-xs font-medium text-[var(--muted)]">
              {CASE_STATUS_LABELS[status]}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {counts[status]}
            </p>
            <span className="text-xs text-[var(--muted)]">件</span>
          </button>
        ))}
      </div>

      {selectedStatus && (
        <div className="app-card rounded-[var(--radius-lg)] p-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            {CASE_STATUS_LABELS[selectedStatus]}の案件（{detailCases.length}件）
          </h3>
          {detailCases.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">該当する案件はありません</p>
          ) : (
            <ul className="space-y-1">
              {detailCases.map((c) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  onDelete={() => handleDelete(c.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
