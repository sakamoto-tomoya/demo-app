"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CalendarView from "@/components/CalendarView";
import { getAssigneeNames } from "@/lib/settings";
import type { CaseStatus } from "@/lib/types";

const VALID_STATUSES: CaseStatus[] = [
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

function CalendarContent() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const assigneeParam = searchParams.get("assignee");
  const selectedDateParam = searchParams.get("selectedDate");
  const statusFilter: CaseStatus | null =
    statusParam && VALID_STATUSES.includes(statusParam as CaseStatus)
      ? (statusParam as CaseStatus)
      : null;
  const assigneeFilter = assigneeParam ? decodeURIComponent(assigneeParam) : null;

  return (
    <CalendarView
      statusFilter={statusFilter}
      assigneeFilter={assigneeFilter}
      selectedDateFromQuery={selectedDateParam}
    />
  );
}

function AssigneeSelectScreen() {
  const router = useRouter();
  const [assigneeNames, setAssigneeNames] = useState<string[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    fetch("/api/settings/user-names")
      .then((res) => res.json())
      .then((data: { names?: string[] }) => {
        const names = Array.isArray(data?.names)
          ? data.names.filter((n) => typeof n === "string" && n.trim())
          : [];
        setAssigneeNames(names.length > 0 ? names : getAssigneeNames());
      })
      .catch(() => setAssigneeNames(getAssigneeNames()));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.trim()) return;
    const params = new URLSearchParams();
    params.set("assignee", selected.trim());
    router.push(`/calendar?${params.toString()}`);
  };

  if (assigneeNames.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-[var(--muted)]">
          設定で現場処理担当者を登録すると、担当者別にスケジュールを確認できます。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="mb-4 text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
        現場処理担当者を選択
      </h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        自分のスケジュールを確認する担当者を選択してください。
      </p>
      <form onSubmit={handleSubmit} className="max-w-xs space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">担当者</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            required
          >
            <option value="">選択してください</option>
            {assigneeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          スケジュールを表示
        </button>
      </form>
    </div>
  );
}

function CalendarPageInner() {
  const searchParams = useSearchParams();
  const assignee = searchParams.get("assignee");

  if (!assignee) {
    return (
      <div className="space-y-6">
        <AssigneeSelectScreen />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CalendarContent />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">読み込み中…</p>}>
      <CalendarPageInner />
    </Suspense>
  );
}
