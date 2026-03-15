"use client";

import { useEffect, useState, useMemo, forwardRef, useImperativeHandle, useRef } from "react";
import Link from "next/link";
import { updateCase } from "@/lib/store";
import { getAllInbound, findVehiclePartByPartNo, normalizePartNo, getRemainingQtyByOrderNo, getOrderRemainingRaw } from "@/lib/parts-store";
import type { CaseRecord } from "@/lib/types";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] min-w-0";
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

const STORAGE_PLACE_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "事務所", label: "事務所" },
  { value: "研修センター", label: "研修センター" },
  { value: "坂本の車載在庫", label: "坂本の車載在庫" },
  { value: "伊野の車載在庫", label: "伊野の車載在庫" },
  { value: "加藤の車載在庫", label: "加藤の車載在庫" },
] as const;

type FormState = {
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
  partsRows: PartsRow[];
  completionTaxRate: string;
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
};

function initialForm(record: CaseRecord | null): FormState {
  if (!record) {
    return {
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
      completionSiteCustomerName: "",
      completionSiteAddress: "",
      completionRepairDetail: "",
      completionTripFee: "3500",
      completionTechnicalQty: "1",
      completionTechnicalUnitPrice: "",
      partsRows: [{ partName: "", orderNos: [""], partNo: "", qty: "", unitPrice: "" }],
      completionTaxRate: "",
      completionRemarks: "",
    };
  }
  return {
    completionRecipient: record.requestStoreName ?? record.completionRecipient ?? "",
    completionRecipientPostalCode: record.completionRecipientPostalCode ?? record.requestPostalCode ?? "",
    completionParkingUsed: record.completionParkingUsed ?? false,
    completionParkingFee: record.completionParkingFee ?? "",
    completionParkingReceiptImageDataUrl: record.completionParkingReceiptImageDataUrl ?? "",
    completionStoragePlace: record.completionStoragePlace ?? "",
    completionGasLeakCheckImageDataUrl: record.completionGasLeakCheckImageDataUrl ?? "",
    completionBeforeWorkPhotos: record.completionBeforeWorkPhotos ?? [],
    completionDuringWorkPhotos: record.completionDuringWorkPhotos ?? [],
    completionAfterWorkPhotos: record.completionAfterWorkPhotos ?? [],
    completionCustomerSignatureDataUrl: record.completionCustomerSignatureDataUrl ?? "",
    completionRecipientAddress: record.completionRecipientAddress ?? record.requestAddress ?? "",
    completionRecipientSpecifiedNo: record.completionRecipientSpecifiedNo ?? "",
    completionSiteCustomerName: record.customerName ?? record.completionSiteCustomerName ?? "",
    completionSiteAddress: record.completionSiteAddress ?? getAddressUpToCityOrWard(record.address ?? ""),
    completionRepairDetail: record.completionRepairDetail ?? "",
    completionTripFee: record.completionTripFee?.replace(/[^0-9]/g, "") || "3500",
    completionTechnicalQty: record.completionTechnicalQty ?? "1",
    completionTechnicalUnitPrice: record.completionTechnicalUnitPrice ?? "",
    partsRows: parsePartsRowsFromRecord(record),
    completionTaxRate: record.completionTaxRate?.replace("%", "") ?? "",
    completionRemarks: record.completionRemarks ?? "",
  };
}

export type CompletionFormPayload = {
  status: "completed";
  completionOutputType: "report";
  completionRecipient?: string;
  completionRecipientPostalCode?: string;
  completionRecipientAddress?: string;
  completionRecipientSpecifiedNo?: string;
  completionSiteCustomerName?: string;
  completionSiteAddress?: string;
  completionRepairDetail?: string;
  completionTripFee?: string;
  completionTechnicalQty?: string;
  completionTechnicalUnitPrice?: string;
  completionTechnicalFee?: string;
  completionPartsUsed?: string;
  completionPartsPartNo?: string;
  completionPartsOrderNo?: string;
  completionPartsQty?: string;
  completionPartsUnitPrice?: string;
  completionPartsTotal?: string;
  completionSubtotal?: string;
  completionTaxRate?: string;
  completionTotalAmount?: string;
  completionRemarks?: string;
  completionParkingUsed?: boolean;
  completionParkingFee?: string;
  completionParkingReceiptImageDataUrl?: string;
  completionStoragePlace?: string;
  completionGasLeakCheckImageDataUrl?: string;
  completionBeforeWorkPhotos?: string[];
  completionDuringWorkPhotos?: string[];
  completionAfterWorkPhotos?: string[];
  completionCustomerSignatureDataUrl?: string;
};

export type CompletionFormSectionHandle = {
  getCompletionPayload: () => CompletionFormPayload;
  /** 出庫登録用：部品品番・数量が入力された行の一覧 */
  getPartsRowsForOutbound: () => { partNo: string; partName: string; qty: number; orderNo: string }[];
};

/** 案件編集フォーム内で「完了」選択時にメモ欄の下に表示する完了報告フォーム */
export const CompletionFormSection = forwardRef<
  CompletionFormSectionHandle,
  { record: CaseRecord; hideSaveButton?: boolean }
>(function CompletionFormSection({ record, hideSaveButton }, ref) {
  const id = record.id;
  const [form, setForm] = useState<FormState>(() => initialForm(record));
  const [saved, setSaved] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodeScanTargetRowIndex, setBarcodeScanTargetRowIndex] = useState(0);
  const parkingReceiptInputRef = useRef<HTMLInputElement>(null);
  const gasLeakInputRef = useRef<HTMLInputElement>(null);
  const beforeWorkInputRef = useRef<HTMLInputElement>(null);
  const duringWorkInputRef = useRef<HTMLInputElement>(null);
  const afterWorkInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setForm(initialForm(record));
  }, [record.id]);

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

  const partsTotal = useMemo(
    () => form.partsRows.reduce((sum, row) => sum + parseNum(row.qty) * parseNum(row.unitPrice), 0),
    [form.partsRows]
  );
  const subtotal = TRIP_FEE + technicalTotal + partsTotal;
  const taxRate = parseNum(form.completionTaxRate);
  const taxAmount = useMemo(() => Math.floor(subtotal * (taxRate / 100)), [subtotal, taxRate]);
  const totalWithTax = subtotal + taxAmount;

  const getCompletionPayload = (): CompletionFormPayload => ({
    status: "completed",
    completionOutputType: "report",
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

  const getPartsRowsForOutbound = (): { partNo: string; partName: string; qty: number; orderNo: string }[] => {
    return form.partsRows
      .filter((r) => (r.partNo ?? "").trim() && parseNum(r.qty) > 0)
      .map((r) => {
        const orderNos = (r.orderNos ?? [""]).map((o) => o.trim()).filter(Boolean);
        return {
          partNo: (r.partNo ?? "").trim(),
          partName: (r.partName ?? "").trim() || "—",
          qty: parseNum(r.qty),
          orderNo: orderNos[0] ?? "",
        };
      });
  };

  useImperativeHandle(ref, () => ({ getCompletionPayload, getPartsRowsForOutbound }), [
    form,
    technicalTotal,
    partsTotal,
    subtotal,
    taxRate,
    totalWithTax,
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    updateCase(id, getCompletionPayload());
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <p className="font-medium text-[var(--foreground)]">完了報告を保存しました。</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/cases/${id}/complete/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
          >
            出力
          </Link>
          <Link
            href={`/cases/${id}/complete`}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
          >
            完了処理ページへ
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleSave(e as unknown as React.FormEvent);
  };

  return (
    <>
      <div className="space-y-4">
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

          {form.partsRows.some((r) => (r.partName || "").trim() === "ボタン軸") && (
            <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)]/50 p-4">
              <label className="block">
                <span className="text-sm font-medium text-[var(--foreground)]">パーキングを使用しましたか？</span>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="parkingUsed"
                      checked={form.completionParkingUsed}
                      onChange={() => setForm((p) => ({ ...p, completionParkingUsed: true }))}
                      className="h-4 w-4 border-[var(--border)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">使用した</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="parkingUsed"
                      checked={!form.completionParkingUsed}
                      onChange={() => setForm((p) => ({ ...p, completionParkingUsed: false }))}
                      className="h-4 w-4 border-[var(--border)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">していない</span>
                  </label>
                </div>
                {form.completionParkingUsed && (
                  <div className="mt-3 flex min-w-0 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={form.completionParkingFee ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, completionParkingFee: e.target.value }))}
                      placeholder="パーキング代を入力してください 例:800"
                      className="block min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                    />
                    <input
                      ref={parkingReceiptInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          setForm((p) => ({ ...p, completionParkingReceiptImageDataUrl: (reader.result as string) ?? "" }));
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                      className="sr-only"
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => parkingReceiptInputRef.current?.click()}
                      className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      title="パーキングレシートを撮影"
                    >
                      レシート撮影
                    </button>
                  </div>
                )}
              </label>
              {(record?.status === "completed" || record?.status === "estimate") && (
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">元々の保管場所は？</span>
                  <select
                    value={form.completionStoragePlace ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, completionStoragePlace: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    {STORAGE_PLACE_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">ガス漏れチェック画像</span>
                <div className="flex flex-wrap items-center gap-2">
                  {form.completionGasLeakCheckImageDataUrl && (
                    <img
                      src={form.completionGasLeakCheckImageDataUrl}
                      alt="ガス漏れチェック"
                      className="h-20 w-20 rounded border border-[var(--border)] object-cover"
                    />
                  )}
                  <input
                    ref={gasLeakInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setForm((p) => ({ ...p, completionGasLeakCheckImageDataUrl: (reader.result as string) ?? "" }));
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                    className="sr-only"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => gasLeakInputRef.current?.click()}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                  >
                    ボタン押して撮影（スマホ・PC兼用）
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">作業前写真を3枚</span>
                <div className="flex flex-wrap items-center gap-2">
                  {(form.completionBeforeWorkPhotos ?? []).map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`作業前${i + 1}`} className="h-20 w-20 rounded border border-[var(--border)] object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            completionBeforeWorkPhotos: (p.completionBeforeWorkPhotos ?? []).filter((_, j) => j !== i),
                          }))
                        }
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs hover:bg-red-50 hover:text-red-600"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(form.completionBeforeWorkPhotos ?? []).length < 3 && (
                    <>
                      <input
                        ref={beforeWorkInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const url = reader.result as string;
                            setForm((p) => ({
                              ...p,
                              completionBeforeWorkPhotos: [...(p.completionBeforeWorkPhotos ?? []), url].slice(0, 3),
                            }));
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                        className="sr-only"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => beforeWorkInputRef.current?.click()}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      >
                        ボタン押して撮影（スマホ・PC兼用）
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">作業中写真を3枚</span>
                <div className="flex flex-wrap items-center gap-2">
                  {(form.completionDuringWorkPhotos ?? []).map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`作業中${i + 1}`} className="h-20 w-20 rounded border border-[var(--border)] object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            completionDuringWorkPhotos: (p.completionDuringWorkPhotos ?? []).filter((_, j) => j !== i),
                          }))
                        }
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs hover:bg-red-50 hover:text-red-600"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(form.completionDuringWorkPhotos ?? []).length < 3 && (
                    <>
                      <input
                        ref={duringWorkInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const url = reader.result as string;
                            setForm((p) => ({
                              ...p,
                              completionDuringWorkPhotos: [...(p.completionDuringWorkPhotos ?? []), url].slice(0, 3),
                            }));
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                        className="sr-only"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => duringWorkInputRef.current?.click()}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      >
                        ボタン押して撮影（スマホ・PC兼用）
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">作業後写真を3枚</span>
                <div className="flex flex-wrap items-center gap-2">
                  {(form.completionAfterWorkPhotos ?? []).map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`作業後${i + 1}`} className="h-20 w-20 rounded border border-[var(--border)] object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            completionAfterWorkPhotos: (p.completionAfterWorkPhotos ?? []).filter((_, j) => j !== i),
                          }))
                        }
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs hover:bg-red-50 hover:text-red-600"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(form.completionAfterWorkPhotos ?? []).length < 3 && (
                    <>
                      <input
                        ref={afterWorkInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const url = reader.result as string;
                            setForm((p) => ({
                              ...p,
                              completionAfterWorkPhotos: [...(p.completionAfterWorkPhotos ?? []), url].slice(0, 3),
                            }));
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                        className="sr-only"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => afterWorkInputRef.current?.click()}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      >
                        ボタン押して撮影（スマホ・PC兼用）
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">お客様サイン欄（スマホで指で書きやすく）</span>
                <div className="flex flex-col gap-2">
                  <canvas
                    ref={signatureCanvasRef}
                    width={320}
                    height={120}
                    className="touch-none rounded-lg border-2 border-[var(--border)] bg-white cursor-crosshair"
                    style={{ touchAction: "none" }}
                    onMouseDown={(e) => {
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      ctx.strokeStyle = "#000";
                      ctx.lineWidth = 2;
                      ctx.lineCap = "round";
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.beginPath();
                      ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                      const draw = (e2: MouseEvent) => {
                        ctx.lineTo((e2.clientX - rect.left) * scaleX, (e2.clientY - rect.top) * scaleY);
                        ctx.stroke();
                      };
                      const stop = () => {
                        window.removeEventListener("mousemove", draw);
                        window.removeEventListener("mouseup", stop);
                        setForm((p) => ({ ...p, completionCustomerSignatureDataUrl: canvas.toDataURL("image/png") }));
                      };
                      window.addEventListener("mousemove", draw);
                      window.addEventListener("mouseup", stop);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      const canvas = signatureCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      ctx.strokeStyle = "#000";
                      ctx.lineWidth = 2;
                      ctx.lineCap = "round";
                      const touch = e.touches[0];
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      ctx.beginPath();
                      ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                      const draw = (e2: Event) => {
                        const te = e2 as TouchEvent;
                        if (!te.touches[0]) return;
                        const t = te.touches[0];
                        ctx.lineTo((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
                        ctx.stroke();
                      };
                      const stop = () => {
                        window.removeEventListener("touchmove", draw);
                        window.removeEventListener("touchend", stop);
                        setForm((p) => ({ ...p, completionCustomerSignatureDataUrl: canvas.toDataURL("image/png") }));
                      };
                      window.addEventListener("touchmove", draw, { passive: false });
                      window.addEventListener("touchend", stop);
                    }}
                    onTouchMove={(e) => e.preventDefault()}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const canvas = signatureCanvasRef.current;
                        if (canvas) {
                          const ctx = canvas.getContext("2d");
                          if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            setForm((p) => ({ ...p, completionCustomerSignatureDataUrl: "" }));
                          }
                        }
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--border)]"
                    >
                      クリア
                    </button>
                    {form.completionCustomerSignatureDataUrl && (
                      <img
                        src={form.completionCustomerSignatureDataUrl}
                        alt="サイン"
                        className="h-12 rounded border border-[var(--border)]"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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

        {!hideSaveButton && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveClick}
              className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              完了報告を保存
            </button>
          </div>
        )}
      </div>

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
            if (idx >= 0 && idx < rows.length) rows[idx] = newRow;
            else if (rows.length === 0) rows.push(newRow);
            else rows[0] = newRow;
            return { ...p, partsRows: rows };
          });
          setBarcodeScannerOpen(false);
        }}
      />
    </>
  );
});
