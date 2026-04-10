"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAllCases } from "@/lib/store";
import type { CaseRecord } from "@/lib/types";
import { formatCompletionDetailForDify } from "@/lib/completion-detail";

/** completionDetail を持ち is_completed が true の完了案件だけ抽出 */
async function getCompletedCasesWithDetail(): Promise<CaseRecord[]> {
  if (typeof window === "undefined") return [];
  const cases = await getAllCases();
  return cases.filter(
    (c) =>
      c.status === "completed" &&
      c.completionDetail != null &&
      c.completionDetail.is_completed === true
  );
}

type CopyFeedback = { id: string; type: "success" | "error"; message: string } | null;

export default function DifyPreviewPage() {
  const [list, setList] = useState<CaseRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getCompletedCasesWithDetail().then(setList);
  }, []);

  const handleCopy = async (recordId: string, text: string) => {
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ id: recordId, type: "success", message: "コピーしました" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "コピーに失敗しました";
      setCopyFeedback({ id: recordId, type: "error", message });
    }
    copyFeedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimerRef.current = null;
    }, 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
          Dify 投入前 確認
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
        >
          トップへ
        </Link>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Turso の完了案件のうち、completionDetail を持つものだけ表示しています。Dify
        ナレッジに投入するテキストを確認できます。
      </p>

      {list.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
          対象の完了案件がありません。完了詳細を登録した完了案件がここに表示されます。
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((record) => {
            const detail = record.completionDetail!;
            const difyText = formatCompletionDetailForDify(detail);
            const isExpanded = expandedId === record.id;

            return (
              <li
                key={record.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid gap-2 text-sm min-w-0 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <span className="text-[var(--muted)]">案件ID</span>
                        <p className="font-mono text-xs text-[var(--foreground)] truncate" title={record.id}>
                          {record.id.slice(0, 8)}…
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">型式</span>
                        <p className="font-medium text-[var(--foreground)]">
                          {detail.model || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">症状分類</span>
                        <p className="text-[var(--foreground)]">
                          {detail.symptom_category || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">解決方法要約</span>
                        <p className="text-[var(--foreground)] line-clamp-2">
                          {detail.solution_summary || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(record.id, difyText)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      >
                        Dify用テキストをコピー
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : record.id)
                        }
                        className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
                      >
                        {isExpanded ? "閉じる" : "Dify用テキストを見る"}
                      </button>
                    </div>
                  </div>
                  {copyFeedback?.id === record.id && (
                    <p
                      className={`mt-2 text-sm ${copyFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}
                    >
                      {copyFeedback.message}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                      <p className="mb-2 text-xs font-medium text-[var(--muted)]">
                        Dify ナレッジ用テキスト（この内容を Dify に投入できます）
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-sm text-[var(--foreground)] font-sans">
                        {difyText || "（内容なし）"}
                      </pre>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/cases/${record.id}/edit`}
                          className="text-xs text-[var(--primary)] underline hover:no-underline"
                        >
                          案件を編集
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[var(--muted)]">
        表示件数: {list.length} 件（completionDetail があり is_completed が true の案件のみ）
      </p>
    </div>
  );
}
