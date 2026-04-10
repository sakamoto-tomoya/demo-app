"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCase } from "@/lib/store";
import type { CaseRecord, ReportStatus } from "@/lib/types";

const CaseForm = dynamic(() => import("@/components/CaseForm"), { ssr: false });

function formatReportDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function isReportGenerated(status: ReportStatus | undefined | null): boolean {
  return status === "generated" || status === "downloaded";
}

export default function EditCasePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const returnTo = (searchParams.get("returnTo") ?? "").trim();
  const [record, setRecord] = useState<CaseRecord | null | undefined>(undefined);
  const [showCompletionActions, setShowCompletionActions] = useState(false);

  useEffect(() => {
    if (!id) {
      setRecord(null);
      return;
    }
    void getCase(id).then(setRecord);
  }, [id]);

  // 他タブ（完了報告書表示など）から戻ったときに案件を再取得して報告書状態を反映
  useEffect(() => {
    if (!id) return;
    const onFocus = () => {
      void getCase(id).then(setRecord);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id]);

  if (record === undefined) {
    return (
      <div className="text-[var(--muted)]">読み込み中…</div>
    );
  }
  if (record === null) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--muted)]">案件が見つかりませんでした。</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
        >
          戻る
        </button>
      </div>
    );
  }

  const unconfirmedFields = record.unconfirmed_fields ?? [];
  const hasUnconfirmed = unconfirmedFields.length > 0;

  return (
    <div className="space-y-6">
      {hasUnconfirmed && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            ⚠️ 以下の情報が未確認です：{unconfirmedFields.join("、")}
          </p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
        >
          戻る
        </button>
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
          案件の追加入力・更新
        </h1>
      </div>
      {record.status === "completed" && (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">完了詳細（Difyナレッジ連携用）</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              症状分類・確定原因・解決方法要約などは完了処理ページで登録・編集できます。
            </p>
            <Link
              href={`/cases/${id}/complete#complete-detail-form`}
              className="mt-3 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
            >
              完了詳細を編集
            </Link>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--foreground)]">完了報告書</p>
            {(() => {
              const status = record.report_status;
              const isGenerated = isReportGenerated(status);
              const generatedAt = record.report_generated_at;
              const downloadedAt = record.report_last_downloaded_at;
              return (
                <p className="text-xs text-[var(--muted)]">
                  {!isGenerated && "完了報告書未作成"}
                  {isGenerated && generatedAt && `最終作成日時 ${formatReportDatetime(generatedAt)}`}
                  {isGenerated && downloadedAt && (generatedAt ? "　" : "") + `最終ダウンロード日時 ${formatReportDatetime(downloadedAt)}`}
                </p>
              );
            })()}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/cases/${id}/complete/print?type=report`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
              >
                完了報告書を見る
              </Link>
              <Link
                href={`/cases/${id}/complete/print?type=report&autoprint=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
              >
                完了報告書PDFダウンロード
              </Link>
              <Link
                href={`/cases/${id}/complete/print?type=report`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
              >
                完了報告書を再生成
              </Link>
            </div>
          </div>
        </>
      )}
      <p className="text-[var(--muted)]">
        内容を修正したり、追加入力してから更新できます。
      </p>
      <CaseForm
        initialRecord={record}
        scheduleReturnTo={returnTo || null}
        onSuccess={() => {
          if (returnTo) {
            router.push(returnTo);
            return;
          }
          setShowCompletionActions(true);
          if (id) void getCase(id).then(setRecord);
        }}
        onCancel={() => router.back()}
        showCompletionActions={record?.status === "completed" || showCompletionActions}
      />
    </div>
  );
}
