"use client";

import { useState } from "react";
import StatusCards from "@/components/StatusCards";
import MapView from "@/components/MapView";
import type { CaseStatus } from "@/lib/types";

/** 案件管理の地図では完了案件のピンを出さない（一覧はカードで絞り込み） */
const DASHBOARD_MAP_EXCLUDE_STATUSES: CaseStatus[] = ["completed"];

export default function DashboardBody() {
  const [activeMapCaseId, setActiveMapCaseId] = useState<string | null>(null);
  /** 下の一覧だけステータスで絞る。地図は常に全件（完了除く）のためここでは地図と同期しない */
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | null>(null);

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">このシステムでできること</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          全体の案件の進捗状況を確認・編集できる、主に管理者向けのページです。
        </p>
      </div>
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">訪問先マップ</h2>
        <p className="text-xs text-[var(--muted)]">
          完了以外の全案件を表示します（ステータスは下のカードで一覧のみ絞り込み）。
        </p>
        <MapView
          showBulkNav={false}
          onActiveCaseChange={setActiveMapCaseId}
          excludeStatuses={DASHBOARD_MAP_EXCLUDE_STATUSES}
          assigneeFilter={null}
          dateFilterOverride=""
        />
      </div>
      <p className="text-sm text-[var(--muted)]">
        ステータス別の件数です。カードをクリックで下に詳細一覧を表示します。
      </p>
      <StatusCards
        selectedStatus={selectedStatus}
        onSelectedStatusChange={setSelectedStatus}
        activeMapCaseId={activeMapCaseId}
      />
    </>
  );
}

