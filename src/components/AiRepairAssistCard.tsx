"use client";

import { useEffect, useMemo, useState } from "react";
import { getRelatedPartsStockForModel } from "@/lib/parts-store";
import type { CaseStatus } from "@/lib/types";

type Props = {
  /** 型式名（空なら非表示） */
  modelName: string;
  /** 症状・受付内容 */
  symptom?: string;
  /** 案件ステータス（表示可否の判定に使用） */
  status: CaseStatus;
  /** 同一画面で案件が切り替わったときにキャッシュをリセットする用 */
  instanceKey?: string;
};

/** AI修理アシストを表示するステータス（完了・キャンセル以外の進行中系） */
const AI_REPAIR_ASSIST_STATUSES: readonly CaseStatus[] = [
  "new",
  "parts_order",
  "estimate",
  "waiting_contact",
  "no_contact",
  "visit_confirmed",
  "contact_only",
  "sns_sent",
] as const;

function isAiRepairAssistVisible(status: CaseStatus, modelName: string): boolean {
  const m = (modelName ?? "").trim();
  if (!m) return false;
  if (status === "completed" || status === "cancelled") return false;
  return (AI_REPAIR_ASSIST_STATUSES as readonly string[]).includes(status);
}

export function AiRepairAssistCard({ modelName, symptom = "", status, instanceKey = "" }: Props) {
  const trimmedModel = (modelName ?? "").trim();
  const trimmedSymptom = (symptom ?? "").trim();

  const visible = useMemo(
    () => isAiRepairAssistVisible(status, modelName),
    [status, modelName]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>("");

  const stockRows = useMemo(() => {
    if (!visible || !trimmedModel) return [];
    return getRelatedPartsStockForModel(trimmedModel);
  }, [visible, trimmedModel]);

  useEffect(() => {
    if (!visible || !trimmedModel) {
      setAnswer("");
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnswer("");

    void (async () => {
      try {
        const res = await fetch("/api/dify/repair-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelName: trimmedModel,
            symptom: trimmedSymptom,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          answer?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? `取得に失敗しました（${res.status}）`);
          return;
        }
        setAnswer(data?.answer != null ? String(data.answer) : "(回答なし)");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "通信エラー");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, trimmedModel, trimmedSymptom, instanceKey]);

  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-blue-500/80 bg-blue-50/30 dark:bg-blue-950/25 p-4 space-y-4">
      <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100">🔧 AI修理アシスト</h2>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)] border-b border-blue-400/40 pb-1">
          ① 同型式の過去修理事例
        </h3>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span
              className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"
              aria-hidden
            />
            <span>回答を取得しています…</span>
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-[var(--alert)] whitespace-pre-wrap">{error}</p>
        )}
        {!loading && !error && (
          <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/60 bg-[var(--background)]/80 p-3">
            <p className="text-xs text-[var(--muted)] italic mb-2">
              ※ 参考情報です。現地確認・社内手順を優先してください。
            </p>
            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{answer || "—"}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)] border-b border-blue-400/40 pb-1">
          ② 在庫状況（型式に紐づく部品）
        </h3>
        <p className="text-xs text-[var(--muted)]">
          製品型番ナレッジ・部品マスタから型式「{trimmedModel}」に関連する品番を検索し、入庫−出庫の残数と車載在庫を表示します。
        </p>
        {stockRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">関連部品が見つかりませんでした。</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-blue-200/80 dark:border-blue-800/60">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="bg-blue-100/50 dark:bg-blue-900/30">
                  <th className="border border-blue-200/60 dark:border-blue-800/50 px-2 py-2 text-left font-medium">
                    品番
                  </th>
                  <th className="border border-blue-200/60 dark:border-blue-800/50 px-2 py-2 text-left font-medium">
                    品名
                  </th>
                  <th className="border border-blue-200/60 dark:border-blue-800/50 px-2 py-2 text-right font-medium">
                    倉庫残（概算）
                  </th>
                  <th className="border border-blue-200/60 dark:border-blue-800/50 px-2 py-2 text-right font-medium">
                    車載
                  </th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r) => (
                  <tr key={r.partNo}>
                    <td className="border border-blue-200/50 dark:border-blue-800/40 px-2 py-1.5 font-mono text-xs">
                      {r.partNo}
                    </td>
                    <td className="border border-blue-200/50 dark:border-blue-800/40 px-2 py-1.5">
                      {r.partName}
                    </td>
                    <td className="border border-blue-200/50 dark:border-blue-800/40 px-2 py-1.5 text-right tabular-nums">
                      {r.warehouseRemaining}
                    </td>
                    <td className="border border-blue-200/50 dark:border-blue-800/40 px-2 py-1.5 text-right tabular-nums">
                      {r.vehicleQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
