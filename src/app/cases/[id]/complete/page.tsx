"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import { getCase, updateCase } from "@/lib/store";
import { getAllInbound, findVehiclePartByPartNo, normalizePartNo, getRemainingQtyByOrderNo, getOrderRemainingRaw, addOutbound, decrementVehiclePartByPartNo } from "@/lib/parts-store";
import { getDefaultOutboundHandlerName } from "@/lib/settings";
import { CASE_STATUS_LABELS, type CaseRecord } from "@/lib/types";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { AiRepairAssistCard } from "@/components/AiRepairAssistCard";

const cellInputClass =
  "w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] min-w-0";

const TRIP_FEE = 3500;
const TAX_RATE_OPTIONS = [
  { value: "", label: "選択してください" },
  { value: "0", label: "0%" },
  { value: "8", label: "8%" },
  { value: "10", label: "10%" },
];

function parseNum(s: string): number {
  const n = parseInt(String(s).replace(/[^0-9０-９]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** 部品品番に一致する部品名を取得（入庫→車載部品の順で検索・全角半角統一） */
function getPartNameByPartNo(partNo: string): string | null {
  const key = normalizePartNo(partNo);
  if (!key) return null;
  const inboundList = getAllInbound()
    .filter((r) => normalizePartNo(r.partNo ?? "") === key)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const fromInbound = inboundList[0];
  if (fromInbound?.partName?.trim()) return fromInbound.partName.trim();
  const vehicle = findVehiclePartByPartNo(partNo);
  if (vehicle?.partName?.trim()) return vehicle.partName.trim();
  return null;
}

/** 品目（部品品番・部品名）に一致する入庫登録の部品単価を取得（直近の入庫を優先・品番は全角半角統一） */
function getPartUnitPriceFromInbound(partKey: string): number | null {
  const key = normalizePartNo(partKey);
  const keyRaw = partKey.trim();
  if (!key && !keyRaw) return null;
  const list = getAllInbound();
  const match = list
    .filter(
      (r) =>
        (r.partNo && normalizePartNo(r.partNo) === key) ||
        (r.partName && r.partName.trim() === keyRaw)
    )
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const latest = match[0];
  if (latest && latest.partCost != null && Number(latest.partCost) >= 0)
    return Number(latest.partCost);
  return null;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 住所から市・区までを返す（お客様住所を現場住所に転記する用）。最後の「市」「区」のいずれかで切る */
function getAddressUpToCityOrWard(address: string): string {
  const t = (address ?? "").trim();
  if (!t) return "";
  let last = -1;
  const iCity = t.lastIndexOf("市");
  const iWard = t.lastIndexOf("区");
  if (iCity >= 0) last = Math.max(last, iCity);
  if (iWard >= 0) last = Math.max(last, iWard);
  if (last < 0) return "";
  return t.slice(0, last + 1);
}

type PartsRow = { partName: string; orderNos: string[]; partNo: string; qty: string; unitPrice: string };
const ORDER_NOS_JOIN = ",";

/** 完了報告・見積作成・請求書作成で表示する項目を制御 */
type CompletionInputMode = "default" | "simple" | "detailed";
const SECTIONS_BY_MODE: Record<CompletionInputMode, readonly string[]> = {
  default: ["header", "recipient", "site", "requestAmount", "itemsTable", "totals", "remarks"],
  simple: ["header", "recipient", "site", "requestAmount", "itemsTable", "totals", "remarks"],
  detailed: ["header", "recipient", "site", "requestAmount", "itemsTable", "totals", "remarks"],
};
function showInMode(mode: CompletionInputMode, section: string): boolean {
  return SECTIONS_BY_MODE[mode].includes(section);
}

function parsePartsRowsFromRecord(c: CaseRecord): PartsRow[] {
  const partName = (c.completionPartsUsed ?? "").split("\n");
  const partNo = (c.completionPartsPartNo ?? "").split("\n");
  const orderNoLines = (c.completionPartsOrderNo ?? "").split("\n");
  const qty = (c.completionPartsQty ?? "").split("\n");
  const price = (c.completionPartsUnitPrice ?? "").split("\n");
  const n = Math.max(partName.length, partNo.length, orderNoLines.length, qty.length, price.length, 1);
  return Array.from({ length: n }, (_, i) => {
    const orderNosRaw = (orderNoLines[i] ?? "").split(ORDER_NOS_JOIN).map((s) => s.trim()).filter(Boolean);
    return {
      partName: partName[i] ?? "",
      orderNos: orderNosRaw.length > 0 ? orderNosRaw : [""],
      partNo: partNo[i] ?? "",
      qty: qty[i] ?? "",
      unitPrice: price[i] ?? "",
    };
  });
}

export default function CompleteCasePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [record, setRecord] = useState<CaseRecord | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodeScanTargetRowIndex, setBarcodeScanTargetRowIndex] = useState(0);
  const parkingReceiptInputRef = useRef<HTMLInputElement>(null);
  const gasLeakInputRef = useRef<HTMLInputElement>(null);
  const beforeWorkInputRef = useRef<HTMLInputElement>(null);
  const duringWorkInputRef = useRef<HTMLInputElement>(null);
  const afterWorkInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const modeParam = searchParams.get("mode");
  const initialMode: "default" | "simple" | "detailed" =
    modeParam === "simple" ? "simple" : modeParam === "detailed" ? "detailed" : "default";
  /** 完了フォームの入力パターン（押したボタンで切り替え） */
  const [completionInputMode, setCompletionInputMode] = useState<"default" | "simple" | "detailed">(initialMode);

  useEffect(() => {
    setCompletionInputMode(initialMode);
  }, [initialMode]);

  /** ページ表示時にフォームへ自動スクロール（リンクから遷移したとき帳票フォームを表示） */
  useEffect(() => {
    if (!record || saved) return;
    const t = setTimeout(() => {
      document.getElementById("complete-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, [record, saved]);

  const [form, setForm] = useState<{
    completionRecipient: string;
    completionRecipientPostalCode: string;
    completionRecipientAddress: string;
    completionRecipientSpecifiedNo: string;
    completionSiteCustomerName: string;
    completionSiteAddress: string;
    completionRepairDetail: string;
    completionTripFee: string;
    completionTechnicalQty: string;
    completionTechnicalUnitPrice: string;
    completionTechnicalFee: string;
    partsRows: PartsRow[];
    completionPartsTotal: string;
    completionSubtotal: string;
    completionTaxRate: string;
    completionTotalAmount: string;
    completionRemarks: string;
    completionParkingUsed: boolean;
    completionParkingFee: string;
    completionParkingReceiptImageDataUrl: string;
    completionStoragePlace: string;
    completionGasLeakCheckImageDataUrl: string;
    completionBeforeWorkPhotos: string[];
    completionDuringWorkPhotos: string[];
    completionAfterWorkPhotos: string[];
    completionCustomerSignatureDataUrl: string;
  }>({
    completionRecipient: "",
    completionRecipientPostalCode: "",
    completionParkingUsed: false,
    completionParkingFee: "",
    completionParkingReceiptImageDataUrl: "",
    completionStoragePlace: "",
    completionGasLeakCheckImageDataUrl: "",
    completionBeforeWorkPhotos: [],
    completionDuringWorkPhotos: [],
    completionAfterWorkPhotos: [],
    completionCustomerSignatureDataUrl: "",
    completionRecipientAddress: "",
    completionRecipientSpecifiedNo: "",
    completionSiteAddress: "",
    completionSiteCustomerName: "",
    completionRepairDetail: "",
    completionTripFee: "3500",
    completionTechnicalQty: "1",
    completionTechnicalUnitPrice: "",
    completionTechnicalFee: "",
    partsRows: [{ partName: "", orderNos: [""], partNo: "", qty: "", unitPrice: "" }],
    completionPartsTotal: "",
    completionSubtotal: "",
    completionTaxRate: "",
    completionTotalAmount: "",
    completionRemarks: "",
  });

  useEffect(() => {
    if (!id) {
      setRecord(null);
      return;
    }
    void (async () => {
      const c = await getCase(id);
      setRecord(c);
      if (!c) return;
      setForm({
        completionRecipient: c.requestStoreName ?? c.completionRecipient ?? "",
        completionRecipientPostalCode: c.completionRecipientPostalCode ?? c.requestPostalCode ?? "",
        completionRecipientAddress: c.completionRecipientAddress ?? c.requestAddress ?? "",
        completionRecipientSpecifiedNo: c.completionRecipientSpecifiedNo ?? "",
        completionSiteCustomerName: c.customerName ?? c.completionSiteCustomerName ?? "",
        completionSiteAddress: c.completionSiteAddress ?? getAddressUpToCityOrWard(c.address ?? ""),
        completionRepairDetail: c.completionRepairDetail ?? "",
        completionTripFee: c.completionTripFee?.replace(/[^0-9]/g, "") || "3500",
        completionTechnicalQty: c.completionTechnicalQty ?? "1",
        completionTechnicalUnitPrice: c.completionTechnicalUnitPrice ?? "",
        completionTechnicalFee: c.completionTechnicalFee ?? "",
        partsRows: parsePartsRowsFromRecord(c),
        completionPartsTotal: c.completionPartsTotal ?? "",
        completionSubtotal: c.completionSubtotal ?? "",
        completionTaxRate: c.completionTaxRate?.replace("%", "") ?? "",
        completionTotalAmount: c.completionTotalAmount ?? "",
        completionRemarks: c.completionRemarks ?? "",
        completionParkingUsed: c.completionParkingUsed ?? false,
        completionParkingFee: c.completionParkingFee ?? "",
        completionParkingReceiptImageDataUrl: c.completionParkingReceiptImageDataUrl ?? "",
        completionStoragePlace: c.completionStoragePlace ?? "",
        completionGasLeakCheckImageDataUrl: c.completionGasLeakCheckImageDataUrl ?? "",
        completionBeforeWorkPhotos: c.completionBeforeWorkPhotos ?? [],
        completionDuringWorkPhotos: c.completionDuringWorkPhotos ?? [],
        completionAfterWorkPhotos: c.completionAfterWorkPhotos ?? [],
        completionCustomerSignatureDataUrl: c.completionCustomerSignatureDataUrl ?? "",
      });
    })();
  }, [id]);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !form.completionCustomerSignatureDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
    img.src = form.completionCustomerSignatureDataUrl;
  }, [form.completionCustomerSignatureDataUrl]);

  const technicalTotal = useMemo(() => {
    const q = parseNum(form.completionTechnicalQty);
    const p = parseNum(form.completionTechnicalUnitPrice);
    return q * p;
  }, [form.completionTechnicalQty, form.completionTechnicalUnitPrice]);

  const partsTotal = useMemo(() => {
    return form.partsRows.reduce(
      (sum, row) => sum + parseNum(row.qty) * parseNum(row.unitPrice),
      0
    );
  }, [form.partsRows]);

  const subtotal = useMemo(() => TRIP_FEE + technicalTotal + partsTotal, [technicalTotal, partsTotal]);
  const taxRate = parseNum(form.completionTaxRate);
  const taxAmount = useMemo(() => Math.floor(subtotal * (taxRate / 100)), [subtotal, taxRate]);
  const totalWithTax = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !record) {
      alert("案件が読み込まれていません。ページを再読み込みするか、編集画面からやり直してください。");
      return;
    }
    try {
    const outputType: "report" | "estimate" | "invoice" =
      completionInputMode === "default" ? "report"
      : completionInputMode === "simple" ? "estimate"
      : "invoice";
    await updateCase(id, {
      status: "completed",
      completionOutputType: outputType,
      completionRecipient: form.completionRecipient || undefined,
      completionRecipientPostalCode: form.completionRecipientPostalCode || undefined,
      completionRecipientAddress: form.completionRecipientAddress || undefined,
      completionRecipientSpecifiedNo: form.completionRecipientSpecifiedNo || undefined,
      completionSiteCustomerName: form.completionSiteCustomerName || undefined,
      completionSiteAddress: form.completionSiteAddress || undefined,
      completionRepairDetail: form.completionRepairDetail || undefined,
      completionTripFee: form.completionTripFee ? `${form.completionTripFee}円` : undefined,
      completionTechnicalQty: form.completionTechnicalQty || undefined,
      completionTechnicalUnitPrice: form.completionTechnicalUnitPrice || undefined,
      completionTechnicalFee: technicalTotal ? String(technicalTotal) : undefined,
      completionPartsUsed: form.partsRows.map((r) => r.partName).join("\n") || undefined,
      completionPartsPartNo: form.partsRows.map((r) => r.partNo).join("\n") || undefined,
      completionPartsOrderNo: form.partsRows.map((r) => r.orderNos.filter(Boolean).join(ORDER_NOS_JOIN)).join("\n") || undefined,
      completionPartsQty: form.partsRows.map((r) => r.qty).join("\n") || undefined,
      completionPartsUnitPrice: form.partsRows.map((r) => r.unitPrice).join("\n") || undefined,
      completionPartsTotal: partsTotal ? String(partsTotal) : undefined,
      completionSubtotal: String(subtotal),
      completionTaxRate: form.completionTaxRate ? `${form.completionTaxRate}%` : undefined,
      completionTotalAmount: String(totalWithTax),
      completionRemarks: form.completionRemarks || undefined,
      completionParkingUsed: form.completionParkingUsed || undefined,
      completionParkingFee: form.completionParkingFee || undefined,
      completionParkingReceiptImageDataUrl: form.completionParkingReceiptImageDataUrl || undefined,
      completionStoragePlace: form.completionStoragePlace || undefined,
      completionGasLeakCheckImageDataUrl: form.completionGasLeakCheckImageDataUrl || undefined,
      completionBeforeWorkPhotos: form.completionBeforeWorkPhotos?.length ? form.completionBeforeWorkPhotos : undefined,
      completionDuringWorkPhotos: form.completionDuringWorkPhotos?.length ? form.completionDuringWorkPhotos : undefined,
      completionAfterWorkPhotos: form.completionAfterWorkPhotos?.length ? form.completionAfterWorkPhotos : undefined,
      completionCustomerSignatureDataUrl: form.completionCustomerSignatureDataUrl || undefined,
    });
    const wasNotCompleted = record.status !== "completed";
    if (wasNotCompleted) {
      const outboundPerson = record.assignedTo?.trim() || getDefaultOutboundHandlerName();
      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      for (const row of form.partsRows) {
      const partNo = (row.partNo ?? "").trim();
      const qty = parseNum(row.qty);
      if (!partNo || qty <= 0) continue;
      const orderNos = (row.orderNos ?? [""]).map((o) => o.trim()).filter(Boolean);
      addOutbound({
        partNo,
        outboundDate: today,
        partName: (row.partName ?? "").trim() || "—",
        outboundQty: qty,
        outboundPerson,
        receptionNo: record.receptionNo?.trim() || undefined,
        orderNo: orderNos[0] ?? undefined,
      });
      decrementVehiclePartByPartNo(partNo, qty);
      }
    }
    setSaved(true);
    } catch (err) {
      console.error("完了処理の保存でエラー:", err);
      alert("保存中にエラーが発生しました。コンソールを確認するか、しばらくして再度お試しください。");
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] min-w-0";

  if (record === undefined) {
    return <div className="text-[var(--muted)]">読み込み中…</div>;
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

  if (saved) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">完了処理</h1>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="font-medium text-[var(--foreground)]">
            保存しました。この案件のステータスを「{CASE_STATUS_LABELS.completed}」に更新しました。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/cases/${id}/complete/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
            >
              出力
            </Link>
            <Link
              href={`/cases/${id}/edit`}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
            >
              編集に戻る
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
            >
              業務ダッシュボードへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">完了処理</h1>
        <button
          type="button"
          onClick={() => {
            document.getElementById("complete-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
            setCompletionInputMode("default");
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 ${completionInputMode === "default" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]"}`}
        >
          完了報告書作成
        </button>
        <button
          type="button"
          onClick={() => {
            setCompletionInputMode("simple");
            document.getElementById("complete-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 ${completionInputMode === "simple" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]"}`}
        >
          見積書作成
        </button>
        <button
          type="button"
          onClick={() => {
            setCompletionInputMode("detailed");
            document.getElementById("complete-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 ${completionInputMode === "detailed" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]"}`}
        >
          請求書作成
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">
        案件「{record.receptionNo || "(番号なし)"} — {record.customerName || ""}」の見積内容を入力し、保存するとステータスが「{CASE_STATUS_LABELS.completed}」に更新されます。
      </p>

      <form id="complete-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">現場住所</span>
            <input
              type="text"
              value={form.completionSiteAddress ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, completionSiteAddress: e.target.value }))}
              className={inputClass}
              placeholder="現場住所を入力"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">作業内容</span>
            <input
              type="text"
              value={form.completionRepairDetail ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, completionRepairDetail: e.target.value }))}
              className={inputClass}
              placeholder="作業内容を入力"
            />
          </label>

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-[var(--foreground)]">ご請求金額</span>
            <span className="text-lg font-semibold text-[var(--foreground)]">¥{totalWithTax.toLocaleString()}</span>
            <span className="text-sm text-[var(--muted)]">（税込）</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse border border-[var(--border)]">
              <thead>
                <tr className="bg-[var(--border)]/30">
                  <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)]">部品名称</th>
                  <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)]">オーダー番号</th>
                  <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)]">部品品番</th>
                  <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)] w-24">数量</th>
                  <th className="border border-[var(--border)] px-3 py-2 text-right text-sm font-medium text-[var(--foreground)] w-28">単価</th>
                  <th className="border border-[var(--border)] px-3 py-2 text-right text-sm font-medium text-[var(--foreground)] w-28">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="border border-[var(--border)] px-3 py-2 text-[var(--foreground)]">出張料</td>
                  <td className="border border-[var(--border)] px-2 py-1 text-left">1</td>
                  <td className="border border-[var(--border)] px-2 py-1 text-right">¥3,500</td>
                  <td className="border border-[var(--border)] px-2 py-1 text-right">¥3,500</td>
                </tr>
                <tr>
                  <td colSpan={3} className="border border-[var(--border)] px-3 py-2 text-[var(--foreground)]">技術料</td>
                  <td className="border border-[var(--border)] px-2 py-1 text-left">
                    <input
                      type="text"
                      value={form.completionTechnicalQty ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, completionTechnicalQty: e.target.value }))}
                      className={cellInputClass}
                      placeholder="1"
                    />
                  </td>
                  <td className="border border-[var(--border)] px-2 py-1">
                    <input
                      type="text"
                      value={form.completionTechnicalUnitPrice ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, completionTechnicalUnitPrice: e.target.value }))}
                      className={cellInputClass}
                      placeholder="単価"
                    />
                  </td>
                  <td className="border border-[var(--border)] px-2 py-1 text-right text-[var(--foreground)]">
                    ¥{technicalTotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)]">使用部品</td>
                </tr>
                {form.partsRows.map((row, idx) => {
                  const rowTotal = parseNum(row.qty) * parseNum(row.unitPrice);
                  return (
                    <tr key={idx}>
                      <td className="border border-[var(--border)] px-2 py-1">
                        <input
                          type="text"
                          value={row.partName}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              partsRows: p.partsRows.map((r, i) => (i === idx ? { ...r, partName: e.target.value } : r)),
                            }))
                          }
                          className={cellInputClass}
                          placeholder="部品名称"
                        />
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1 align-top">
                        <div className="flex flex-col gap-1 min-w-0">
                          {row.orderNos.map((orderNoVal, oIdx) => (
                            <input
                              key={oIdx}
                              type="text"
                              value={orderNoVal}
                              onChange={(e) => {
                                const newOrderNo = e.target.value;
                                const partKey = row.partNo.trim();
                                const qtyRaw = partKey && newOrderNo.trim() ? getOrderRemainingRaw(partKey, newOrderNo.trim()) : null;
                                setForm((p) => ({
                                  ...p,
                                  partsRows: p.partsRows.map((r, i) => {
                                    if (i !== idx) return r;
                                    const next = [...r.orderNos];
                                    next[oIdx] = newOrderNo;
                                    return {
                                      ...r,
                                      orderNos: next,
                                      ...(oIdx === 0 && qtyRaw != null ? { qty: String(qtyRaw) } : {}),
                                    };
                                  }),
                                }));
                              }}
                              className={cellInputClass}
                              placeholder="オーダー番号"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1">
                        <div className="flex min-w-0 gap-1">
                          <input
                            type="text"
                            value={row.partNo}
                            onChange={(e) => {
                              const partNo = e.target.value;
                              setForm((p) => {
                                const next = p.partsRows.map((r, i) => (i === idx ? { ...r, partNo } : r));
                                const partKey = partNo.trim();
                                if (partKey) {
                                  const partName = getPartNameByPartNo(partKey);
                                  const unitPrice = getPartUnitPriceFromInbound(partKey);
                                  const byOrder = getRemainingQtyByOrderNo(partKey);
                                  const orderNo = byOrder.length > 0 ? byOrder[0].orderNo : "";
                                  const qtyRaw = orderNo ? getOrderRemainingRaw(partKey, orderNo) : null;
                                  return {
                                    ...p,
                                    partsRows: next.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            ...(partName != null ? { partName } : {}),
                                            ...(unitPrice != null ? { unitPrice: String(unitPrice) } : {}),
                                            ...(orderNo ? { orderNos: [orderNo] } : {}),
                                            ...(qtyRaw != null ? { qty: String(qtyRaw) } : {}),
                                          }
                                        : r
                                    ),
                                  };
                                }
                                return { ...p, partsRows: next };
                              });
                            }}
                            onBlur={() => {
                              const partKey = row.partNo.trim();
                              if (!partKey) return;
                              const partName = getPartNameByPartNo(partKey);
                              const unitPrice = getPartUnitPriceFromInbound(partKey);
                              const byOrder = getRemainingQtyByOrderNo(partKey);
                              const orderNo = byOrder.length > 0 ? byOrder[0].orderNo : "";
                              const qtyRaw = orderNo ? getOrderRemainingRaw(partKey, orderNo) : null;
                              setForm((p) => ({
                                ...p,
                                partsRows: p.partsRows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        ...(partName != null ? { partName } : {}),
                                        ...(unitPrice != null ? { unitPrice: String(unitPrice) } : {}),
                                        ...(orderNo ? { orderNos: [orderNo] } : {}),
                                        ...(qtyRaw != null ? { qty: String(qtyRaw) } : {}),
                                      }
                                    : r
                                ),
                              }));
                            }}
                            className={cellInputClass}
                            placeholder="部品品番"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setBarcodeScanTargetRowIndex(idx);
                              setBarcodeScannerOpen(true);
                            }}
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--border)]"
                            title="バーコードをスキャン"
                          >
                            読取
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                partsRows: [...p.partsRows, { partName: "", orderNos: [""], partNo: "", qty: "", unitPrice: "" }],
                              }))
                            }
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--border)]"
                            title="追加"
                          >
                            追加
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((p) => {
                                const next = p.partsRows.filter((_, i) => i !== idx);
                                return { ...p, partsRows: next.length > 0 ? next : [{ partName: "", orderNos: [""], partNo: "", qty: "", unitPrice: "" }] };
                              });
                            }}
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--border)]"
                            title="削除"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1 align-top">
                        <input
                          type="text"
                          value={row.qty}
                          onChange={(e) => {
                            const newQty = e.target.value;
                            setForm((p) => {
                              const next = p.partsRows.map((r, i) => (i === idx ? { ...r, qty: newQty } : r));
                              const partKey = p.partsRows[idx]?.partNo.trim();
                              let orderNos = [...(p.partsRows[idx]?.orderNos ?? [""])];
                              if (!partKey) return { ...p, partsRows: next };
                              const qtyNum = parseNum(newQty);
                              const byOrder = getRemainingQtyByOrderNo(partKey);
                              let added = false;
                              for (;;) {
                                let totalRem = 0;
                                const trimmed = orderNos.map((o) => o.trim()).filter(Boolean);
                                for (const o of trimmed) {
                                  const r = getOrderRemainingRaw(partKey, o);
                                  if (r != null) totalRem += r;
                                }
                                if (qtyNum <= totalRem) break;
                                const existingSet = new Set(trimmed);
                                const nextOrder = byOrder.find((o) => o.remaining > 0 && !existingSet.has(o.orderNo.trim()));
                                if (!nextOrder) break;
                                orderNos = [...orderNos, nextOrder.orderNo];
                                added = true;
                              }
                              if (!added) return { ...p, partsRows: next };
                              return {
                                ...p,
                                partsRows: next.map((r, i) => (i === idx ? { ...r, orderNos } : r)),
                              };
                            });
                          }}
                          className={cellInputClass}
                          placeholder="数量"
                        />
                        {(() => {
                          const partKey = row.partNo.trim();
                          const trimmed = row.orderNos.map((o) => o.trim()).filter(Boolean);
                          if (!partKey || trimmed.length === 0) return null;
                          let totalRem = 0;
                          for (const orderKey of trimmed) {
                            const r = getOrderRemainingRaw(partKey, orderKey);
                            if (r != null) totalRem += r;
                          }
                          const qtyNum = parseNum(row.qty);
                          if (qtyNum <= totalRem) return null;
                          return (
                            <p className="mt-1 text-xs text-[var(--alert)]" role="alert">
                              在庫（{totalRem}）を超えています
                            </p>
                          );
                        })()}
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1">
                        <input
                          type="text"
                          value={row.unitPrice}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              partsRows: p.partsRows.map((r, i) => (i === idx ? { ...r, unitPrice: e.target.value } : r)),
                            }))
                          }
                          className={cellInputClass}
                          placeholder="単価"
                        />
                      </td>
                      <td className="border border-[var(--border)] px-2 py-1 text-right text-[var(--foreground)]">
                        ¥{rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <table className="w-full max-w-xs border-collapse">
              <tbody>
                <tr>
                  <td className="border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)]">小計</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right text-[var(--foreground)]">¥{subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                    消費税（
                    <select
                      value={form.completionTaxRate ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, completionTaxRate: e.target.value }))}
                      className="inline-block rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-sm text-[var(--foreground)]"
                    >
                      {TAX_RATE_OPTIONS.map((opt) => (
                        <option key={opt.value || "empty"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    ）
                  </td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right text-[var(--foreground)]">¥{taxAmount.toLocaleString()}</td>
                </tr>
                <tr className="bg-[var(--border)]/20">
                  <td className="border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">合計</td>
                  <td className="border border-[var(--border)] px-3 py-2 text-right font-semibold text-[var(--foreground)]">¥{totalWithTax.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">備考</span>
            <textarea
              value={form.completionRemarks ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, completionRemarks: e.target.value }))}
              rows={3}
              className={inputClass}
              placeholder="備考を入力"
            />
          </label>
        </div>

        <AiRepairAssistCard
          modelName={record.modelName ?? ""}
          symptom={record.inquiryContent ?? ""}
          status={record.status}
          instanceKey={id}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            保存
          </button>
          <Link
            href={`/cases/${id}/edit`}
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
          >
            編集に戻る
          </Link>
        </div>
      </form>

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onDetected={(value) => {
          const partName = getPartNameByPartNo(value) ?? "";
          const unitPrice = getPartUnitPriceFromInbound(value);
          const byOrder = getRemainingQtyByOrderNo(value);
          const orderNo = byOrder.length > 0 ? byOrder[0].orderNo : "";
          const qtyRaw = orderNo ? getOrderRemainingRaw(value, orderNo) : null;
          setForm((p) => {
            const idx = barcodeScanTargetRowIndex;
            const rows = [...p.partsRows];
            const newRow = {
              partName,
              orderNos: orderNo ? [orderNo] : (rows[idx]?.orderNos ?? [""]),
              partNo: value,
              qty: qtyRaw != null ? String(qtyRaw) : (rows[idx]?.qty ?? ""),
              unitPrice: unitPrice != null ? String(unitPrice) : (rows[idx]?.unitPrice ?? ""),
            };
            if (idx >= 0 && idx < rows.length) {
              rows[idx] = newRow;
            } else if (rows.length === 0) {
              rows.push(newRow);
            } else {
              rows[0] = newRow;
            }
            return { ...p, partsRows: rows };
          });
          setBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
}
