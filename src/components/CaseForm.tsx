"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { runPdfOcr, type OcrResult } from "@/lib/ocr";
import { addCase, addRoutePin, updateCase, getAllCases } from "@/lib/store";
import { addOutbound, decrementVehiclePartByPartNo } from "@/lib/parts-store";
import { getFieldHandlerNames, getDefaultOutboundHandlerName } from "@/lib/settings";
import { CASE_STATUS_LABELS, type CaseStatus, type CaseRecord } from "@/lib/types";
import { CompletionFormSection, type CompletionFormSectionHandle } from "@/components/CompletionFormSection";

type FormState = {
  receptionNo: string;
  requestStoreName: string;
  requestStoreFurigana: string;
  requestContactName: string;
  requestPhone: string;
  requestFax: string;
  requestAddress: string;
  requestPostalCode: string;
  requestSpecifiedNo: string;
  requestStoreEmail: string;
  receptionDate: string;
  desiredVisitDate: string;
  desiredVisitTime: string;
  warranty: string;
  paymentMethod: string;
  billingName: string;
  billingPostalCode: string;
  billingAddress: string;
  customerName: string;
  customerFurigana: string;
  postalCode: string;
  address: string;
  phone: string;
  mobile: string;
  modelName: string;
  reportedModelName: string;
  gasType: string;
  inquiryContent: string;
  internalContact: string;
  memo: string;
  status: CaseStatus;
  assignedTo: string;
  visitTimeStart: string;
  visitTimeEnd: string;
  visitTimeMorningContact: boolean;
  contactAttemptTimes: string[];
  visitDate: string;
};

const DEFAULT_FORM: FormState = {
  receptionNo: "",
  requestStoreName: "",
  requestStoreFurigana: "",
  requestContactName: "",
  requestPhone: "",
  requestFax: "",
  requestAddress: "",
  requestPostalCode: "",
  requestSpecifiedNo: "",
  requestStoreEmail: "",
  receptionDate: "",
  desiredVisitDate: "",
  desiredVisitTime: "",
  warranty: "",
  paymentMethod: "",
  billingName: "",
  billingPostalCode: "",
  billingAddress: "",
  customerName: "",
  customerFurigana: "",
  postalCode: "",
  address: "",
  phone: "",
  mobile: "",
  modelName: "",
  reportedModelName: "",
  gasType: "",
  inquiryContent: "",
  internalContact: "",
  memo: "",
  status: "new",
  assignedTo: "未割当",
  visitTimeStart: "",
  visitTimeEnd: "",
  visitTimeMorningContact: false,
  contactAttemptTimes: [],
  visitDate: "",
};

/** PDFの値が空白または「様」のみの場合は転記しない（既存値を維持） */
function skipOcrText(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || v === "様";
}

/** 住所転記時に「ッ」「優先電話」「優先番号」を除去する */
function cleanAddressForTranscribe(s: string | undefined): string {
  return (s ?? "")
    .replace(/\s*優先電話\s*/g, " ")
    .replace(/\s*優先番号\s*/g, " ")
    .replace(/ッ\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyOcrToForm(prev: FormState, r: OcrResult): FormState {
  return {
    ...prev,
    receptionNo: r.receptionNo || prev.receptionNo,
    requestStoreName: skipOcrText(r.requestStoreName) ? prev.requestStoreName : (r.requestStoreName || prev.requestStoreName),
    requestStoreFurigana: skipOcrText(r.requestStoreFurigana) ? prev.requestStoreFurigana : (r.requestStoreFurigana || prev.requestStoreFurigana),
    requestContactName: skipOcrText(r.requestContactName) ? prev.requestContactName : (r.requestContactName || prev.requestContactName),
    requestPhone: (() => {
      const resolved =
        r.requestPhone ||
        (r.requestPhoneFax
          ? r.requestPhoneFax
              .replace(/\s*FAX\s*[\s\S]*/i, "")
              .replace(/\s/g, "")
              .replace(/[-－−ー]/g, "")
              .replace(/[、，,.\s]+$/g, "")
              .trim()
          : "");
      const v = (resolved ?? "").trim();
      if (!v || /^9*$/.test(v.replace(/\D/g, ""))) return prev.requestPhone;
      return resolved || prev.requestPhone;
    })(),
    requestFax:
      r.requestFax ||
      (r.requestPhoneFax
        ? r.requestPhoneFax
            .replace(/^[\s\S]*?FAX\s*[：:]?\s*/i, "")
            .replace(/\s/g, "")
            .replace(/[-－−ー]/g, "")
            .replace(/[、，,.\s]+$/g, "")
            .trim()
        : "") ||
      prev.requestFax,
    ...((): { requestAddress: string; requestPostalCode: string } => {
      const raw = (r.requestAddress || "").replace(/^\s*依頼元住所[：:]?\s*/, "").trim() || prev.requestAddress;
      const leadingZip = raw.match(/^\s*([０-９0-9]{3}[-\s－ー]?[０-９0-9]{4}|[０-９0-9]{7})\s*/);
      if (leadingZip && !r.requestPostalCode) {
        const seven = leadingZip[1].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, "").slice(0, 7);
        if (seven.length === 7) {
          return {
            requestAddress: cleanAddressForTranscribe(raw.replace(/^\s*[０-９0-9]{3}[-\s－ー]?[０-９0-9]{4}\s*|^\s*[０-９0-9]{7}\s*/, "")),
            requestPostalCode: seven,
          };
        }
      }
      return {
        requestAddress: cleanAddressForTranscribe(raw),
        requestPostalCode: r.requestPostalCode || prev.requestPostalCode,
      };
    })(),
    receptionDate: r.receptionDate || prev.receptionDate,
    desiredVisitDate: r.desiredVisitDate || prev.desiredVisitDate,
    desiredVisitTime: r.desiredVisitTime || prev.desiredVisitTime,
    warranty: r.warranty || prev.warranty,
    paymentMethod: r.paymentMethod || prev.paymentMethod,
    billingName: prev.billingName,
    billingPostalCode: prev.billingPostalCode,
    billingAddress: prev.billingAddress,
    customerName: skipOcrText(r.customerName) ? prev.customerName : (r.customerName || prev.customerName),
    customerFurigana: skipOcrText(r.customerFurigana) ? prev.customerFurigana : (r.customerFurigana || prev.customerFurigana),
    postalCode: r.postalCode || prev.postalCode,
    address: cleanAddressForTranscribe(r.address || prev.address),
    phone: (() => {
      const v = (r.phone ?? "").trim();
      if (!v || /^9*$/.test(v.replace(/\D/g, ""))) return prev.phone;
      return r.phone || prev.phone;
    })(),
    mobile: (() => {
      const v = (r.mobile ?? "").trim();
      if (!v || /^9*$/.test(v.replace(/\D/g, ""))) return prev.mobile;
      return r.mobile || prev.mobile;
    })(),
    modelName: r.modelName || prev.modelName,
    reportedModelName: r.reportedModelName || prev.reportedModelName,
    gasType: r.gasType || prev.gasType,
    inquiryContent: r.inquiryContent || prev.inquiryContent,
    internalContact: r.internalContact || prev.internalContact,
    memo: r.memo || prev.memo,
    assignedTo: prev.assignedTo,
    visitTimeStart: prev.visitTimeStart,
    visitTimeEnd: prev.visitTimeEnd,
    visitTimeMorningContact: prev.visitTimeMorningContact,
    contactAttemptTimes: prev.contactAttemptTimes,
  };
}

function recordToFormState(record: CaseRecord): FormState {
  return {
    receptionNo: record.receptionNo ?? "",
    requestStoreName: record.requestStoreName ?? "",
    requestStoreFurigana: record.requestStoreFurigana ?? "",
    requestContactName: record.requestContactName ?? "",
    requestPhone: record.requestPhone ?? "",
    requestFax: record.requestFax ?? "",
    requestAddress: cleanAddressForTranscribe(record.requestAddress ?? ""),
    requestPostalCode: record.requestPostalCode ?? "",
    requestSpecifiedNo: record.requestSpecifiedNo ?? "",
    requestStoreEmail: record.requestStoreEmail ?? "",
    receptionDate: record.receptionDate ?? "",
    desiredVisitDate: record.desiredVisitDate ?? "",
    desiredVisitTime: record.desiredVisitTime ?? "",
    warranty: record.warranty ?? "",
    paymentMethod: record.paymentMethod ?? "",
    billingName: record.billingName ?? "",
    billingPostalCode: record.billingPostalCode ?? "",
    billingAddress: record.billingAddress ?? "",
    customerName: record.customerName ?? "",
    customerFurigana: record.customerFurigana ?? "",
    postalCode: record.postalCode ?? "",
    address: cleanAddressForTranscribe(record.address ?? ""),
    phone: record.phone ?? "",
    mobile: record.mobile ?? "",
    modelName: record.modelName ?? "",
    reportedModelName: record.reportedModelName ?? "",
    gasType: record.gasType ?? "",
    inquiryContent: record.inquiryContent ?? "",
    internalContact: record.internalContact ?? "",
    memo: record.memo ?? "",
    status: record.status ?? "new",
    assignedTo: record.assignedTo?.trim() || "未割当",
    visitTimeStart: record.visitTimeStart ?? "",
    visitTimeEnd: record.visitTimeEnd ?? "",
    visitTimeMorningContact: record.visitTimeMorningContact ?? false,
    contactAttemptTimes: record.contactAttemptTimes ?? [],
    visitDate: record.visitDate ? record.visitDate.slice(0, 10) : "",
  };
}

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
  /** 指定時は編集モード（追加入力・更新） */
  initialRecord?: CaseRecord | null;
  /** 登録後に完了報告書・見積・請求書のボタンを表示する */
  showCompletionActions?: boolean;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]";

export default function CaseForm({ onSuccess, onCancel, initialRecord, showCompletionActions }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialRecord ? recordToFormState(initialRecord) : DEFAULT_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [addressMapLat, setAddressMapLat] = useState<number | null>(null);
  const [addressMapLng, setAddressMapLng] = useState<number | null>(null);
  const [addressMapDemo, setAddressMapDemo] = useState(false);
  const [addressMapLoading, setAddressMapLoading] = useState(false);
  const [addressMapError, setAddressMapError] = useState<string | null>(null);
  const addressMapContainerRef = useRef<HTMLDivElement>(null);
  const addressMapInstanceRef = useRef<{ map: import("leaflet").Map; L: typeof import("leaflet") } | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [routePinFeedback, setRoutePinFeedback] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const completionFormRef = useRef<CompletionFormSectionHandle | null>(null);

  useEffect(() => {
    setAssigneeOptions(getFieldHandlerNames());
  }, []);

  /** 同じ依頼元の直近案件からメールアドレスを自動入力 */
  useEffect(() => {
    const name = (form.requestStoreName ?? "").trim();
    if (!name || (form.requestStoreEmail ?? "").trim()) return;
    const all = getAllCases();
    const same = all
      .filter((c) => (c.requestStoreName ?? "").trim() === name && (c.requestStoreEmail ?? "").trim())
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const last = same[0];
    if (last?.requestStoreEmail?.trim()) {
      setForm((prev) => ({ ...prev, requestStoreEmail: (last.requestStoreEmail ?? "").trim() }));
    }
  }, [form.requestStoreName]);

  /** スマホの現在地を取得し、現在地→目的地のルートをGoogle Mapsで開く */
  const openNavWithCurrentLocation = useCallback(
    (destinationLat?: number, destinationLng?: number) => {
      const destAddress = [form.postalCode, form.address].filter(Boolean).join(" ").trim();
      const hasDest = (destinationLat != null && destinationLng != null) || destAddress.length > 0;
      if (!hasDest) {
        setNavError("住所を入力してください");
        return;
      }
      setNavError(null);
      setNavLoading(true);
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setNavError("お使いの環境では現在地を利用できません");
        setNavLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
          const destination =
            destinationLat != null && destinationLng != null
              ? `${destinationLat},${destinationLng}`
              : encodeURIComponent(destAddress);
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
          window.open(url, "_blank", "noopener,noreferrer");
          setNavLoading(false);
        },
        () => {
          setNavError("現在地を取得できませんでした。位置情報の利用を許可してください。");
          setNavLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    },
    [form.address, form.postalCode]
  );

  const registerRoutePin = useCallback(() => {
    if (addressMapLat == null || addressMapLng == null) return;
    const address = [form.postalCode, form.address].filter(Boolean).join(" ").trim() || form.address.trim();
    if (!address) return;
    addRoutePin({
      address,
      lat: addressMapLat,
      lng: addressMapLng,
      label: form.customerName.trim() || undefined,
    });
    setRoutePinFeedback("ルートに登録しました");
    setTimeout(() => setRoutePinFeedback(null), 3000);
  }, [addressMapLat, addressMapLng, form.address, form.postalCode, form.customerName]);

  const applyOcr = useCallback((result: OcrResult) => {
    setForm((prev) => applyOcrToForm(prev, result));
  }, []);

  const openAddressMap = useCallback(async () => {
    const address = form.address.trim();
    const postalCode = form.postalCode.replace(/\D/g, "").slice(0, 7);
    if (!address && !postalCode) {
      setAddressMapError("住所または郵便番号を入力してください");
      setShowAddressMap(true);
      return;
    }
    setAddressMapError(null);
    setAddressMapLoading(true);
    setShowAddressMap(true);
    setAddressMapLat(null);
    setAddressMapLng(null);
    setAddressMapDemo(false);
    try {
      const params = new URLSearchParams();
      if (address) params.set("address", address);
      if (postalCode) params.set("postalCode", postalCode);
      const res = await fetch(`/api/geocode?${params}`);
      const data = (await res.json()) as { lat: number | null; lng: number | null; error?: string; demo?: boolean };
      if (data.error || (data.lat == null && data.lng == null)) {
        setAddressMapError("住所から位置を取得できませんでした");
        return;
      }
      setAddressMapLat(data.lat!);
      setAddressMapLng(data.lng!);
      setAddressMapDemo(!!data.demo);
    } catch {
      setAddressMapError("地図の取得に失敗しました");
    } finally {
      setAddressMapLoading(false);
    }
  }, [form.address, form.postalCode]);

  useEffect(() => {
    if (!showAddressMap || addressMapLat == null || addressMapLng == null || !addressMapContainerRef.current) return;
    let mounted = true;
    const init = async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !addressMapContainerRef.current || addressMapInstanceRef.current) return;
      const map = L.map(addressMapContainerRef.current).setView([addressMapLat, addressMapLng], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      L.marker([addressMapLat, addressMapLng]).addTo(map);
      addressMapInstanceRef.current = { map, L };
    };
    init();
    return () => {
      mounted = false;
      if (addressMapInstanceRef.current) {
        addressMapInstanceRef.current.map.remove();
        addressMapInstanceRef.current = null;
      }
    };
  }, [showAddressMap, addressMapLat, addressMapLng]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.type !== "application/pdf") {
        setError("PDFファイルを選択してください");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const result = await runPdfOcr(file);
        applyOcr(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "OCRに失敗しました");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [applyOcr]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const postalCode = form.postalCode.replace(/\D/g, "").slice(0, 7);
    const address = form.address.trim();
    let lat: number | null = null;
    let lng: number | null = null;
    if (address || postalCode) {
      try {
        const params = new URLSearchParams();
        if (address) params.set("address", address);
        if (postalCode) params.set("postalCode", postalCode);
        const res = await fetch(`/api/geocode?${params}`);
        if (res.ok) {
          const data = (await res.json()) as { lat: number | null; lng: number | null };
          lat = data.lat ?? null;
          lng = data.lng ?? null;
        }
      } catch {
        // ジオコーディング失敗時は緯度経度なしで登録
      }
    }
    const payload = {
      receptionNo: form.receptionNo || undefined,
      requestStoreName: form.requestStoreName || undefined,
      requestStoreFurigana: form.requestStoreFurigana || undefined,
      requestContactName: form.requestContactName || undefined,
      requestPhone: form.requestPhone || undefined,
      requestFax: form.requestFax || undefined,
      requestAddress: form.requestAddress || undefined,
      requestPostalCode: form.requestPostalCode || undefined,
      requestSpecifiedNo: form.requestSpecifiedNo || undefined,
      requestStoreEmail: form.requestStoreEmail.trim() || undefined,
      receptionDate: form.receptionDate || undefined,
      desiredVisitDate: form.desiredVisitDate || undefined,
      desiredVisitTime: form.desiredVisitTime || undefined,
      warranty: form.warranty || undefined,
      paymentMethod: form.paymentMethod || undefined,
      billingName: form.billingName.trim() || undefined,
      billingPostalCode: form.billingPostalCode.trim() || undefined,
      billingAddress: form.billingAddress.trim() || undefined,
      customerName: form.customerName.trim(),
      customerFurigana: form.customerFurigana || undefined,
      postalCode,
      address,
      phone: form.phone.trim(),
      mobile: form.mobile || undefined,
      modelName: form.modelName || undefined,
      reportedModelName: form.reportedModelName || undefined,
      gasType: form.gasType || undefined,
      inquiryContent: form.inquiryContent || undefined,
      internalContact: form.internalContact || undefined,
        memo: form.memo.trim(),
        status: form.status,
        assignedTo: form.assignedTo.trim() || undefined,
        visitTimeStart: form.status === "no_contact" ? undefined : (form.visitTimeMorningContact ? undefined : (form.visitTimeStart.trim() || undefined)),
        visitTimeEnd: form.status === "no_contact" ? undefined : (form.visitTimeMorningContact ? undefined : (form.visitTimeEnd.trim() || undefined)),
        visitTimeMorningContact: form.visitTimeMorningContact || undefined,
        contactAttemptTimes: form.status === "no_contact" && form.contactAttemptTimes.length > 0 ? form.contactAttemptTimes : undefined,
        visitDate: form.visitDate.trim() || null,
      lat,
      lng,
    };
    try {
      if (initialRecord?.id) {
        const finalPayload =
          form.status === "completed" && completionFormRef.current
            ? { ...payload, ...completionFormRef.current.getCompletionPayload() }
            : payload;
        updateCase(initialRecord.id, finalPayload);
        const wasNotCompleted = initialRecord.status !== "completed";
        if (wasNotCompleted && form.status === "completed" && completionFormRef.current) {
          const rows = completionFormRef.current.getPartsRowsForOutbound();
          const outboundPerson = form.assignedTo?.trim() || getDefaultOutboundHandlerName();
          const today = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })();
          for (const row of rows) {
            if (!row.partNo || row.qty <= 0) continue;
            addOutbound({
              partNo: row.partNo,
              outboundDate: today,
              partName: row.partName,
              outboundQty: row.qty,
              outboundPerson,
              receptionNo: form.receptionNo?.trim() || undefined,
              orderNo: row.orderNo || undefined,
            });
            decrementVehiclePartByPartNo(row.partNo, row.qty);
          }
        }
      } else {
        addCase(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : (initialRecord ? "更新に失敗しました" : "登録に失敗しました"));
    }
  };

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  }, []);

  const statusOptions = (Object.entries(CASE_STATUS_LABELS) as [CaseStatus, string][]).map(
    ([value, label]) => ({ value, label })
  );

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = (i % 2) * 30;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          PDFで自動転記（出張修理依頼書）
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">
          PDFを選択すると下の各項目に自動反映します
        </p>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="mt-3 block w-full text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-[var(--primary-foreground)] file:text-sm"
        />
        {uploading && (
          <p className="mt-2 text-sm text-[var(--primary)]">OCR処理中…</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--alert)] bg-[var(--alert-bg)] px-4 py-3 text-sm text-[var(--alert)]">
          {error}
        </div>
      )}

      {/* 修理受付・依頼元 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          修理受付・依頼元
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">修理受付番号</span>
            <div className="mt-1 flex min-w-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-1 py-1">
              <input
                type="text"
                value={form.receptionNo}
                onChange={(e) => set("receptionNo", e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)] outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ご依頼店名</span>
            <input type="text" value={form.requestStoreName} onChange={(e) => set("requestStoreName", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">フリガナ（依頼店）</span>
            <input type="text" value={form.requestStoreFurigana} onChange={(e) => set("requestStoreFurigana", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ご担当者名</span>
            <input type="text" value={form.requestContactName} onChange={(e) => set("requestContactName", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">電話番号（依頼店）</span>
            <div className="flex gap-2 items-center">
              <a href={`tel:${form.requestPhone.replace(/\D/g, "")}`} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline whitespace-nowrap">
                電話をかける
              </a>
              <input type="tel" value={form.requestPhone} onChange={(e) => set("requestPhone", e.target.value)} className={inputClass + " flex-1 min-w-0"} placeholder="0448610072" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">FAX番号（依頼店）</span>
            <input type="tel" value={form.requestFax} onChange={(e) => set("requestFax", e.target.value)} className={inputClass} placeholder="0448610073" />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">依頼元郵便番号</span>
              <input type="text" placeholder="2160006" value={form.requestPostalCode} onChange={(e) => set("requestPostalCode", e.target.value)} className={inputClass} />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">御社指定No</span>
              <input type="text" value={form.requestSpecifiedNo} onChange={(e) => set("requestSpecifiedNo", e.target.value)} className={inputClass} />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">報告用メールアドレス</span>
              <input type="email" inputMode="email" autoComplete="email" placeholder="依頼元のメールアドレス" value={form.requestStoreEmail} onChange={(e) => set("requestStoreEmail", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">依頼元住所</span>
            <input type="text" value={form.requestAddress} onChange={(e) => set("requestAddress", cleanAddressForTranscribe(e.target.value))} className={inputClass} />
          </label>
        </div>
      </section>

      {/* 受付日・訪問希望 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          受付日・訪問希望
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">受付日</span>
            <input type="text" placeholder="2026/03/11" value={form.receptionDate} onChange={(e) => set("receptionDate", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">訪問希望日</span>
            <input type="text" placeholder="03/16" value={form.desiredVisitDate} onChange={(e) => set("desiredVisitDate", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">訪問希望時間</span>
            <input type="text" placeholder="15:00-16:00" value={form.desiredVisitTime} onChange={(e) => set("desiredVisitTime", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">保証</span>
            <input type="text" value={form.warranty} onChange={(e) => set("warranty", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">支払方法</span>
            <select
              value={form.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
              className={inputClass}
            >
              <option value="">選択してください</option>
              <option value="直収">直収</option>
              <option value="現地請求（依頼元へ請求書発行）">現地請求（依頼元へ請求書発行）</option>
              <option value="現地請求（指定先別途請求書発行）">現地請求（指定先別途請求書発行）</option>
              <option value="代理店請求">代理店請求</option>
              <option value="無償">無償</option>
            </select>
          </label>
          {form.paymentMethod === "現地請求（指定先別途請求書発行）" && (
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2 border border-[var(--border)] rounded-lg p-4 bg-[var(--card)]">
              <h3 className="text-sm font-semibold text-[var(--foreground)] sm:col-span-2">請求先（指定先）</h3>
              <label className="block">
                <span className="text-sm font-medium text-[var(--foreground)]">請求先宛名</span>
                <input type="text" value={form.billingName} onChange={(e) => set("billingName", e.target.value)} className={inputClass} placeholder="宛名を入力" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--foreground)]">郵便番号</span>
                <input type="text" placeholder="2160006" value={form.billingPostalCode} onChange={(e) => set("billingPostalCode", e.target.value)} className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-[var(--foreground)]">住所</span>
                <input type="text" value={form.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} className={inputClass} />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* お客様 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          お客様
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">お客様名</span>
            <input type="text" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ﾌﾘｶﾞﾅ（お客様）</span>
            <input type="text" value={form.customerFurigana} onChange={(e) => set("customerFurigana", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">郵便番号</span>
            <input type="text" placeholder="2160006" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputClass} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">住所</span>
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              <input type="text" value={form.address} onChange={(e) => set("address", cleanAddressForTranscribe(e.target.value))} className={inputClass + " flex-1 min-w-0"} />
              <button type="button" onClick={openAddressMap} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] whitespace-nowrap">
                地図を確認する
              </button>
              <button
                type="button"
                onClick={() => openNavWithCurrentLocation()}
                disabled={(!form.address.trim() && !form.postalCode.trim()) || navLoading}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  form.address.trim() || form.postalCode.trim()
                    ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-60"
                    : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                }`}
              >
                {navLoading ? "現在地を取得中…" : "ナビを起動"}
              </button>
              {navError && (
                <p className="w-full text-sm text-red-600 mt-0.5">{navError}</p>
              )}
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">自宅電話</span>
            <div className="flex gap-2 items-center">
              <a href={`tel:${form.phone.replace(/\D/g, "")}`} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline whitespace-nowrap">
                電話をかける
              </a>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass + " flex-1 min-w-0"} />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">携帯番号</span>
            <div className="flex gap-2 items-center">
              <a href={`tel:${form.mobile.replace(/\D/g, "")}`} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline whitespace-nowrap">
                電話をかける
              </a>
              <input type="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className={inputClass + " flex-1 min-w-0"} />
            </div>
          </label>
        </div>
      </section>

      {/* 店舗・機種（機種のみ） */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          機種
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">型式名</span>
            <input type="text" placeholder="PH-2425AW" value={form.modelName} onChange={(e) => set("modelName", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">お申し出型式名</span>
            <input type="text" value={form.reportedModelName} onChange={(e) => set("reportedModelName", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ｶﾞｽ種</span>
            <select
              value={form.gasType}
              onChange={(e) => set("gasType", e.target.value)}
              className={inputClass}
            >
              <option value="">選択してください</option>
              <option value="都市ガス（13A)">都市ガス（13A)</option>
              <option value="プロパン（LPG）">プロパン（LPG）</option>
            </select>
          </label>
        </div>
      </section>

      {/* 問合/依頼内容 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          問合/依頼内容
        </h2>
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">内容（症状・使用年数・請求先等）</span>
          <textarea
            value={form.inquiryContent}
            onChange={(e) => set("inquiryContent", e.target.value)}
            rows={5}
            className={inputClass}
            placeholder="■使用年数（購入日）：〜 ■症状：〜 ■連絡日時：〜 ■請求先：〜 など"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">社内連絡</span>
          <textarea
            value={form.internalContact}
            onChange={(e) => set("internalContact", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="社内連絡事項を入力"
          />
        </label>
      </section>

      {/* メモ・ステータス・訪問予定日 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          管理項目
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ステータス</span>
            <select
              value={form.status}
              onChange={(e) => {
                const next = e.target.value as CaseStatus;
                const keepsVisitTime = next === "new" || next === "visit_confirmed" || next === "contact_only";
                setForm((p) => ({
                  ...p,
                  status: next,
                  ...(keepsVisitTime ? {} : { visitTimeStart: "", visitTimeEnd: "", visitTimeMorningContact: false }),
                  ...(next !== "no_contact" ? { contactAttemptTimes: [] } : {}),
                }));
              }}
              className={inputClass}
            >
              {statusOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">担当者</span>
            <select
              value={form.assignedTo}
              onChange={(e) => set("assignedTo", e.target.value)}
              className={inputClass}
            >
              <option value="">選択してください</option>
              <option value="未割当">未割当</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">{form.status === "sns_sent" ? "送信日" : form.status === "contact_only" || form.status === "waiting_contact" || form.status === "no_contact" ? "連絡日" : form.status === "parts_order" ? "部品手配日" : form.status === "estimate" ? "請求書発行日" : "登録日"}</span>
            <input type="date" value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} className={inputClass} />
          </label>
          {form.status !== "parts_order" && form.status !== "estimate" && (
            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {form.status === "contact_only" ? "連絡のみ指定時間" : form.status === "sns_sent" ? "送信時間" : form.status === "waiting_contact" ? "連絡時間" : form.status === "no_contact" ? "連絡実施時間" : "連絡予定時間"}
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {form.status === "no_contact" ? (
                  <div className="mt-1 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-1 sm:grid-cols-6">
                      {timeOptions.map((t) => (
                        <label key={t} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={form.contactAttemptTimes.includes(t)}
                            onChange={(e) => {
                              setForm((p) => ({
                                ...p,
                                contactAttemptTimes: e.target.checked
                                  ? [...p.contactAttemptTimes, t].sort()
                                  : p.contactAttemptTimes.filter((v) => v !== t),
                              }));
                            }}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span className="text-[var(--foreground)]">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <select
                      value={form.visitTimeStart}
                      onChange={(e) => set("visitTimeStart", e.target.value)}
                      className={inputClass}
                      disabled={form.status !== "contact_only" && form.visitTimeMorningContact}
                    >
                      <option value="">--</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {form.status !== "waiting_contact" && (
                      <>
                        <span className="text-[var(--muted)]">～</span>
                        <select
                          value={form.visitTimeEnd}
                          onChange={(e) => set("visitTimeEnd", e.target.value)}
                          className={inputClass}
                          disabled={form.status !== "contact_only" && form.visitTimeMorningContact}
                        >
                          <option value="">--</option>
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}
                {form.status !== "contact_only" && form.status !== "waiting_contact" && form.status !== "no_contact" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (form.visitTimeMorningContact) {
                        setForm((p) => ({ ...p, visitTimeMorningContact: false }));
                      } else {
                        setForm((p) => ({
                          ...p,
                          visitTimeMorningContact: true,
                          visitTimeStart: "",
                          visitTimeEnd: "",
                        }));
                      }
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
                      form.visitTimeMorningContact
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {form.visitTimeMorningContact ? "当日朝連絡（解除）" : "当日訪問時間連絡予定"}
                  </button>
                )}
              </div>
              {form.visitTimeMorningContact && form.status !== "contact_only" && (
                <p className="mt-1 text-xs text-[var(--muted)]">訪問時間は当日朝に連絡する予定です</p>
              )}
            </label>
          )}
        </div>
      </section>

      {(form.status === "completed" || form.status === "estimate") && initialRecord && (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-4">
            {form.status === "estimate" ? "見積内訳" : "完了内訳"}
          </h2>
          <CompletionFormSection
            ref={completionFormRef}
            record={{
              ...initialRecord,
              status: form.status,
              requestStoreName: form.requestStoreName,
              requestPostalCode: form.requestPostalCode,
              requestAddress: form.requestAddress,
              customerName: form.customerName,
              address: form.address,
            }}
            hideSaveButton
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
        >
          {initialRecord ? "登録" : "登録する"}
        </button>
        {showCompletionActions && initialRecord?.id && (
          <>
            <Link
              href={`/cases/${initialRecord.id}/complete/print?type=report`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 bg-[var(--primary)] text-[var(--primary-foreground)] no-underline"
            >
              完了報告書作成
            </Link>
            <Link
              href={`/cases/${initialRecord.id}/complete/print?type=estimate`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] no-underline inline-flex items-center"
            >
              見積書作成
            </Link>
            <Link
              href={`/cases/${initialRecord.id}/complete/print?type=invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] no-underline inline-flex items-center"
            >
              請求書作成
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--border)]"
        >
          キャンセル
        </button>
      </div>
    </form>

    {showAddressMap && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddressMap(false)}>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">地図を確認</h3>
            <div className="flex gap-2">
              {addressMapLat != null && addressMapLng != null && (
                <>
                  <button
                    type="button"
                    onClick={registerRoutePin}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                  >
                    ルート登録
                  </button>
                  <button
                    type="button"
                    onClick={() => openNavWithCurrentLocation(addressMapLat, addressMapLng)}
                    disabled={navLoading}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-60"
                  >
                    {navLoading ? "現在地を取得中…" : "ナビを起動"}
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setShowAddressMap(false); setNavError(null); setRoutePinFeedback(null); }} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]">
                閉じる
              </button>
            </div>
          </div>
          <div className="p-4">
            {addressMapLoading && (
              <p className="text-sm text-[var(--muted)]">位置を取得しています…</p>
            )}
            {addressMapError && !addressMapLoading && (
              <p className="text-sm text-red-600">{addressMapError}</p>
            )}
            {navError && (
              <p className="text-sm text-red-600 mt-2">{navError}</p>
            )}
            {routePinFeedback && (
              <p className="text-sm text-[var(--primary)] mt-2">{routePinFeedback}</p>
            )}
            {addressMapDemo && !addressMapLoading && (
              <p className="text-sm text-[var(--muted)] mb-2">※ 表示位置はデモ用サンプル（東京駅付近）です。</p>
            )}
            {!addressMapLoading && addressMapLat != null && addressMapLng != null && (
              <div ref={addressMapContainerRef} className="h-[400px] w-full rounded-xl border border-[var(--border)]" />
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}
