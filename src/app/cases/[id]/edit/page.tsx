"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCase } from "@/lib/store";
import type { CaseRecord } from "@/lib/types";

const CaseForm = dynamic(() => import("@/components/CaseForm"), { ssr: false });

export default function EditCasePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [record, setRecord] = useState<CaseRecord | null | undefined>(undefined);
  const [showCompletionActions, setShowCompletionActions] = useState(false);

  useEffect(() => {
    if (!id) {
      setRecord(null);
      return;
    }
    setRecord(getCase(id));
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

  return (
    <div className="space-y-6">
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
      <p className="text-[var(--muted)]">
        内容を修正したり、追加入力してから更新できます。
      </p>
      <CaseForm
        initialRecord={record}
        onSuccess={() => setShowCompletionActions(true)}
        onCancel={() => router.back()}
        showCompletionActions={showCompletionActions}
      />
    </div>
  );
}
