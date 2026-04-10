"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  getCaseCounts,
  getAllCases,
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

/** 一覧では単独表示するステータス（それ以外のカード選択時はこれらを除く全件をまとめて表示） */
const DASHBOARD_LIST_EXCLUDED_FROM_BUNDLE: CaseStatus[] = [
  "completed",
  "cancelled",
  "visit_confirmed",
];

/** 未アクション点滅の対象ステータス（未確認項目ありのときのみ。訪問日確定・完了・キャンセルは点滅しない） */
const UNACTION_BLINK_STATUSES = new Set<CaseStatus>([
  "new",
  "parts_order",
  "estimate",
  "waiting_contact",
  "no_contact",
  "contact_only",
  "sns_sent",
]);

function isUnactionBlinkCase(c: CaseRecord): boolean {
  return (c.unconfirmed_fields?.length ?? 0) > 0 && UNACTION_BLINK_STATUSES.has(c.status);
}

function formatAddressShort(address: string | undefined): string {
  if (!address?.trim()) return "";
  const s = address.replace(/^神奈川県\s*/, "").trim();
  const idx = s.indexOf("枡形");
  return idx >= 0 ? s.slice(0, idx + 2) : s;
}

/** 一覧表示用（ジオコーディング精度の確認に使う） */
function formatPostalDisplay(raw: string | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  const t = (raw ?? "").trim();
  return t || "—";
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

function escapeHtmlPrint(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildUnactionCasesPrintHtml(cases: CaseRecord[], listContextLabel: string): string {
  const issued = format(new Date(), "yyyy/MM/dd HH:mm", { locale: ja });
  const rows = cases
    .map((c, idx) => {
      const model =
        c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName
          ? `${c.modelName} / ${c.reportedModelName}`
          : c.modelName || c.reportedModelName || "—";
      const uf = (c.unconfirmed_fields ?? []).join("、") || "—";
      const addr = (c.address ?? "").trim() || "—";
      return `<tr>
      <td style="text-align:right">${idx + 1}</td>
      <td>${escapeHtmlPrint(c.receptionNo || "—")}</td>
      <td>${escapeHtmlPrint(getStatusLabel(c.status))}</td>
      <td>${escapeHtmlPrint(model)}</td>
      <td>${escapeHtmlPrint((c.customerName ?? "").trim() || "—")}</td>
      <td>${escapeHtmlPrint(addr)}</td>
      <td>${escapeHtmlPrint((c.assignedTo ?? "").trim() || "未割当")}</td>
      <td>${escapeHtmlPrint(uf)}</td>
      <td>${escapeHtmlPrint(format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja }))}</td>
    </tr>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<title>未アクション案件一覧</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; margin: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 11px; color: #444; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #333; padding: 5px 6px; vertical-align: top; word-break: break-word; }
  th { background: #f3f4f6; text-align: left; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <h1>未アクション案件一覧（${escapeHtmlPrint(listContextLabel)}の一覧内）</h1>
  <p class="meta">出力件数: ${cases.length}件／出力日時: ${escapeHtmlPrint(issued)}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>受付番号</th>
        <th>ステータス</th>
        <th>型式</th>
        <th>お客様名</th>
        <th>住所</th>
        <th>担当</th>
        <th>未確認項目</th>
        <th>更新日</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta" style="margin-top:12px">印刷で「PDFに保存」「Microsoft Print to PDF」などを選ぶとPDF化できます。</p>
</body>
</html>`;
}

/**
 * 印刷ダイアログを開く（PDFは印刷先で「PDFに保存」を選択）。
 * 非表示 iframe で印刷する（ポップアップ+noopener だと print が効かない環境があるため）。
 */
function openUnactionCasesPrint(cases: CaseRecord[], listContextLabel: string) {
  if (typeof window === "undefined" || cases.length === 0) return;
  const html = buildUnactionCasesPrintHtml(cases, listContextLabel);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "print-unaction-cases";
  iframe.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const iwin = iframe.contentWindow;
  const idoc = iframe.contentDocument ?? iwin?.document;
  if (!iwin || !idoc) {
    iframe.remove();
    printUnactionViaBlobUrl(html);
    return;
  }

  idoc.open();
  idoc.write(html);
  idoc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  const runPrint = () => {
    try {
      iwin.focus();
      iwin.print();
    } catch {
      window.alert("印刷ダイアログを開けませんでした。別ブラウザでお試しください。");
    }
    iwin.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 90_000);
  };

  // レイアウト確定後に print（2フレーム待ちで Chrome でも安定しやすい）
  const schedulePrint = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(runPrint, 50);
      });
    });
  };

  if (idoc.readyState === "complete") {
    schedulePrint();
  } else {
    iwin.addEventListener("load", schedulePrint, { once: true });
  }
}

/** iframe が使えないときの予備：Blob URL で別タブを開いて印刷 */
function printUnactionViaBlobUrl(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    window.alert(
      "印刷用ウィンドウを開けませんでした。ブラウザのポップアップを許可するか、別タブで開ける設定にしてください。"
    );
    return;
  }
  const revokeLater = () => setTimeout(() => URL.revokeObjectURL(url), 120_000);
  w.addEventListener(
    "load",
    () => {
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          window.alert("印刷を開始できませんでした。");
        }
        revokeLater();
      }, 250);
    },
    { once: true }
  );
}

/** 未アクション：親が setInterval で渡す lit で点滅（CSS アニメーションは使わない） */
function UnactionBlinkBadge({ lit }: { lit: boolean }) {
  return (
    <span
      className="mr-1 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium text-white"
      style={{
        opacity: lit ? 1 : 0.2,
        backgroundColor: lit ? "#f59e0b" : "#78350f",
        boxShadow: lit ? "0 0 0 1px rgba(245, 158, 11, 0.95)" : "none",
      }}
      title="未確認項目あり（追記で解消）"
    >
      未アクション
    </span>
  );
}

function CaseRow({
  c,
  onDelete,
  unactionBlinkLit,
}: {
  c: CaseRecord;
  onDelete: () => void;
  unactionBlinkLit: boolean;
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
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-2">
          <div className="mb-1">
            {isUnactionBlinkCase(c) && <UnactionBlinkBadge lit={unactionBlinkLit} />}
          </div>
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

interface StatusCardsProps {
  selectedStatus?: CaseStatus | null;
  onSelectedStatusChange?: (status: CaseStatus | null) => void;
  /** 地図で選択中の案件ID（一覧の該当行を赤枠点滅で強調） */
  activeMapCaseId?: string | null;
}

export default function StatusCards({
  selectedStatus: controlledStatus,
  onSelectedStatusChange,
  activeMapCaseId,
}: StatusCardsProps = {}) {
  const [counts, setCounts] = useState<Record<CaseStatus, number>>(ZERO_COUNTS as Record<CaseStatus, number>);
  const [alertCount, setAlertCount] = useState(0);
  const [uncontrolledStatus, setUncontrolledStatus] = useState<CaseStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allCases, setAllCases] = useState<CaseRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const [nextCounts, nextAllCases] = await Promise.all([getCaseCounts(), getAllCases()]);
      setCounts(nextCounts);
      setAllCases(nextAllCases);
      setAlertCount(nextAllCases.filter(shouldAlert).length);
    })();
  }, [refreshKey]);

  const selectedStatus = controlledStatus !== undefined ? controlledStatus : uncontrolledStatus;

  const { detailCases, listHeading, printContextLabel } = useMemo(() => {
    if (!selectedStatus) {
      return { detailCases: [] as CaseRecord[], listHeading: "", printContextLabel: "" };
    }
    if (DASHBOARD_LIST_EXCLUDED_FROM_BUNDLE.includes(selectedStatus)) {
      const list = allCases.filter((c) => c.status === selectedStatus);
      return {
        detailCases: list,
        listHeading: `${CASE_STATUS_LABELS[selectedStatus]}の案件（${list.length}件）`,
        printContextLabel: CASE_STATUS_LABELS[selectedStatus],
      };
    }
    const list = allCases
      .filter((c) => !DASHBOARD_LIST_EXCLUDED_FROM_BUNDLE.includes(c.status))
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt).getTime();
        const tb = new Date(b.updatedAt || b.createdAt).getTime();
        return tb - ta;
      });
    return {
      detailCases: list,
      listHeading: `対応中案件一覧（完了・キャンセル・訪問日確定を除く）（${list.length}件）`,
      printContextLabel: "対応中一覧（完了・キャンセル・訪問日確定を除く）",
    };
  }, [selectedStatus, allCases]);

  const unactionCasesInDetail = useMemo(
    () => detailCases.filter(isUnactionBlinkCase),
    [detailCases]
  );

  /** 未アクション行があるときだけ 1 本のタイマーで全バッジを同期点滅（JavaScript のみ） */
  const [unactionBlinkLit, setUnactionBlinkLit] = useState(true);
  useEffect(() => {
    if (unactionCasesInDetail.length === 0) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 1600 : 420;
    const id = window.setInterval(() => {
      setUnactionBlinkLit((v) => !v);
    }, ms);
    return () => window.clearInterval(id);
  }, [unactionCasesInDetail.length, selectedStatus, refreshKey]);

  useEffect(() => {
    if (!activeMapCaseId) return;
    if (!detailCases.some((c) => c.id === activeMapCaseId)) return;
    const el = document.querySelector<HTMLElement>(
      `[data-map-case-row="${CSS.escape(activeMapCaseId)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeMapCaseId, detailCases]);

  const handleCardClick = (status: CaseStatus) => {
    const next =
      selectedStatus === status
        ? null
        : status;

    if (controlledStatus !== undefined) {
      onSelectedStatusChange?.(next);
    } else {
      setUncontrolledStatus(next);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCase(id);
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{listHeading}</h3>
            {detailCases.length > 0 && (
              <button
                type="button"
                disabled={unactionCasesInDetail.length === 0}
                title={
                  unactionCasesInDetail.length === 0
                    ? "この一覧に、対象ステータスかつ未確認項目ありの案件がありません"
                    : `未アクション${unactionCasesInDetail.length}件を印刷。ダイアログで「PDFに保存」を選ぶとPDFになります`
                }
                onClick={() => openUnactionCasesPrint(unactionCasesInDetail, printContextLabel)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                未アクションのみ印刷（PDF保存）
              </button>
            )}
          </div>
          {detailCases.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">該当する案件はありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--border)]/40">
                    <th className="border border-[var(--border)] px-2 py-1 text-left">受付番号</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">現在のステータス</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">型式</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">担当者</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">郵便番号</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">訪問先住所</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">登録日</th>
                    <th className="border border-[var(--border)] px-2 py-1 text-left">訪問日</th>
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
                      <td className="border border-[var(--border)] px-2 py-1">
                        {isUnactionBlinkCase(c) && (
                          <span className="mr-1 align-middle">
                            <UnactionBlinkBadge lit={unactionBlinkLit} />
                          </span>
                        )}
                        {c.receptionNo || "(番号なし)"}
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1">{getStatusLabel(c.status)}</td>
                      <td className="border border-[var(--border)] px-2 py-1">
                        {(c.modelName && c.reportedModelName && c.modelName !== c.reportedModelName)
                          ? `${c.modelName} / ${c.reportedModelName}`
                          : (c.modelName || c.reportedModelName || "未入力")}
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1">{c.assignedTo?.trim() || "未割当"}</td>
                      <td className="border border-[var(--border)] px-2 py-1 whitespace-nowrap font-mono text-xs">
                        {formatPostalDisplay(c.postalCode)}
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1">{formatAddressShort(c.address) || "未入力"}</td>
                      <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                      <td className="border border-[var(--border)] px-2 py-1">{c.visitDate ? formatVisitDate(c.visitDate) : "未設定"}</td>
                      <td className="border border-[var(--border)] px-2 py-1">{format(parseISO(c.updatedAt || c.createdAt), "yyyy/MM/dd", { locale: ja })}</td>
                      <td className="border border-[var(--border)] px-2 py-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/cases/${c.id}/edit`} className="text-[var(--primary)] hover:underline">
                            詳細
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(c.id)}
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
          )}
        </div>
      )}
    </div>
  );
}
