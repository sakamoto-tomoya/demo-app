"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { OcrResult } from "@/lib/ocr";
import type { OcrFieldMapping } from "@/lib/ocr-types";
import { OcrResultPanel } from "@/components/OcrResultPanel";
import { DateInput, DateTextInput } from "@/components/DateInput";
import { addCase, addRoutePin, updateCase, getAllCases } from "@/lib/store";
import type { VisitEfficiencySuggestionItem } from "@/lib/visit-efficiency-suggestions";
import { addOutbound, decrementVehiclePartByPartNo } from "@/lib/parts-store";
import { getFieldHandlerNames, getDefaultOutboundHandlerName, getAssigneeNames } from "@/lib/settings";
import CaseChat from "@/components/CaseChat";
import { CASE_STATUS_LABELS, type CaseStatus, type CaseRecord } from "@/lib/types";
import { validateCompletionDetail, buildCompletionDetail, formatCompletionDetailForDify } from "@/lib/completion-detail";
import { buildDifyDocumentName, sha256Hex } from "@/lib/dify-sync";
import { CompletionFormSection, type CompletionFormSectionHandle } from "@/components/CompletionFormSection";
import { CompletionDetailForm, type CompletionDetailFormHandle } from "@/components/CompletionDetailForm";
import { AiRepairAssistCard } from "@/components/AiRepairAssistCard";
import CasesAssistant from "@/components/CasesAssistant";

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
  /** 問合内容の生テキスト（分解前） */
  inquiry_raw: string;
  /** 問合先頭行から抽出した型式候補 */
  model_candidate: string;
  symptom: string;
  usage_years_note: string;
  contact_datetime_note: string;
  preferred_visit_note: string;
  fee_explanation_note: string;
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
  inquiry_raw: "",
  model_candidate: "",
  symptom: "",
  usage_years_note: "",
  contact_datetime_note: "",
  preferred_visit_note: "",
  fee_explanation_note: "",
  status: "new",
  assignedTo: "未割当",
  visitTimeStart: "",
  visitTimeEnd: "",
  visitTimeMorningContact: false,
  contactAttemptTimes: [],
  visitDate: "",
};

/** 見出し・ラベル文言（パロマ社内用等）なら空扱いにして転記しない */
function emptyIfHeader(value: string | undefined): string {
  const v = (value ?? "").trim();
  return /^(パ?ロマ)?社内用$/i.test(v) ? "" : (value ?? "").trim();
}

/** PDFの値が空白・「様」のみ・見出し文言の場合は転記しない（既存値を維持） */
function skipOcrText(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v || v === "様") return true;
  if (/^(パ?ロマ)?社内用$/i.test(v)) return true;
  return false;
}

/** OCRの支払方法文言を select の option value に合わせて正規化 */
const PAYMENT_OPTIONS = [
  "直収",
  "現地請求（依頼元へ請求書発行）",
  "現地請求（指定先別途請求書発行）",
  "代理店請求",
  "無償",
] as const;
function normalizePaymentMethod(ocr: string | undefined): string {
  const v = (ocr ?? "").trim();
  if (!v) return "";
  const exact = PAYMENT_OPTIONS.find((o) => o === v);
  if (exact) return exact;
  if (/現金|現地請求.*依頼元|直収/i.test(v)) return "現地請求（依頼元へ請求書発行）";
  if (/指定先別途|別途請求/i.test(v)) return "現地請求（指定先別途請求書発行）";
  if (/代理店/i.test(v)) return "代理店請求";
  if (/無償|無料/i.test(v)) return "無償";
  if (/直収/i.test(v)) return "直収";
  return v;
}

/** ガス種 select 用: OCR値を「都市ガス（13A)」「プロパン（LPG）」に正規化 */
const GAS_TYPE_OPTIONS = ["都市ガス（13A)", "プロパン（LPG）"] as const;
function normalizeGasType(ocr: string | undefined): string {
  const v = (ocr ?? "").trim();
  if (!v) return "";
  const exact = GAS_TYPE_OPTIONS.find((o) => o === v);
  if (exact) return exact;
  if (/13A|都市ガス|都市\s*ガス/i.test(v)) return "都市ガス（13A)";
  if (/LPG|LP\b|プロパン|プロパンガス/i.test(v)) return "プロパン（LPG）";
  return "";
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
    receptionNo: emptyIfHeader(r.receptionNo) || prev.receptionNo,
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
    receptionDate: emptyIfHeader(r.receptionDate) || r.receptionDate || prev.receptionDate,
    desiredVisitDate: (() => {
      const v = (emptyIfHeader(r.desiredVisitDate) || r.desiredVisitDate || "").trim();
      if (v === "訪問" || v === "希望") return prev.desiredVisitDate;
      return v || prev.desiredVisitDate;
    })(),
    desiredVisitTime: emptyIfHeader(r.desiredVisitTime) || r.desiredVisitTime || prev.desiredVisitTime,
    warranty: emptyIfHeader(r.warranty) || r.warranty || prev.warranty,
    paymentMethod: normalizePaymentMethod(emptyIfHeader(r.paymentMethod) || r.paymentMethod) || prev.paymentMethod,
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
    /* model -> 型式名: 空でなければ上書き。model_candidate も補完 */
    modelName: (() => {
      const v = ((r.modelName || r.model_candidate) ?? "").trim();
      return v ? v : prev.modelName;
    })(),
    /* reported_model -> お申し出型式名: 空なら上書きしない */
    reportedModelName: (() => {
      const v = (r.reportedModelName ?? "").trim();
      return v ? v : prev.reportedModelName;
    })(),
    /* gas_type -> ｶﾞｽ種: select 用に正規化（都市ガス系->都市ガス（13A)、プロパン系->プロパン（LPG）） */
    gasType: (() => {
      const normalized = normalizeGasType(r.gasType);
      return normalized ? normalized : prev.gasType;
    })(),
    /* inquiry_raw → 問合/依頼内容の textarea のみに転記（社内連絡欄には入れない） */
    inquiryContent: (() => {
      const src = r.inquiry_raw ?? r.inquiryContent ?? "";
      return src.trim() ? src : prev.inquiryContent;
    })(),
    /* 社内連絡 → placeholder「社内連絡事項を入力」の textarea に転記 */
    internalContact: r.internalContact || prev.internalContact,
    memo: r.memo || prev.memo,
    inquiry_raw: r.inquiry_raw ?? prev.inquiry_raw,
    model_candidate: r.model_candidate ?? prev.model_candidate,
    symptom: r.symptom ?? prev.symptom,
    usage_years_note: r.usage_years_note ?? prev.usage_years_note,
    contact_datetime_note: r.contact_datetime_note ?? prev.contact_datetime_note,
    preferred_visit_note: r.preferred_visit_note ?? prev.preferred_visit_note,
    fee_explanation_note: r.fee_explanation_note ?? prev.fee_explanation_note,
    assignedTo: prev.assignedTo,
    visitTimeStart: prev.visitTimeStart,
    visitTimeEnd: prev.visitTimeEnd,
    visitTimeMorningContact: prev.visitTimeMorningContact,
    contactAttemptTimes: prev.contactAttemptTimes,
  };
}

/** 指定ミリ秒でタイムアウトする Promise を返す（reject） */
function timeoutPromise(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`タイムアウト: ${label} (${ms}ms)`)), ms)
  );
}

/** Promise を指定時間で打ち切り、タイムアウト時は reject */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([promise, timeoutPromise(ms, label)]);
}

/** fetch にタイムアウトを付与（AbortController） */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`タイムアウト: ${label} (${timeoutMs}ms)`);
    }
    throw err;
  }
}

/** 受付専用OCR（intake-primary）: カスタムモデル解析、最大60秒待機 */
const INTAKE_PRIMARY_TIMEOUT_MS = 60_000;

/** 必須項目（未入力なら赤枠・警告・上記内容で登録のみ表示）。警告には実際に空の項目だけを動的表示し、すべて入力済みなら警告ボックスは非表示。 */
const REQUIRED_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "receptionNo", label: "修理受付番号" },
  { key: "requestStoreName", label: "ご依頼店名" },
  { key: "requestPhone", label: "電話番号（依頼元）" },
  { key: "customerName", label: "お客様名" },
  { key: "address", label: "住所（お客様）" },
  { key: "phone", label: "電話番号（お客様）" },
  { key: "inquiryContent", label: "問合/依頼内容" },
];

function isRequiredFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
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
    inquiry_raw: record.inquiry_raw ?? "",
    model_candidate: record.model_candidate ?? "",
    symptom: record.symptom ?? "",
    usage_years_note: record.usage_years_note ?? "",
    contact_datetime_note: record.contact_datetime_note ?? "",
    preferred_visit_note: record.preferred_visit_note ?? "",
    fee_explanation_note: record.fee_explanation_note ?? "",
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
  onSuccess: (recordId?: string) => void;
  onCancel: () => void;
  /** 指定時は編集モード（追加入力・更新） */
  initialRecord?: CaseRecord | null;
  /** 登録後に完了報告書・見積・請求書のボタンを表示する */
  showCompletionActions?: boolean;
  /** カレンダー等への戻り先URL（指定時はボタンで優先利用） */
  scheduleReturnTo?: string | null;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]";

export default function CaseForm({ onSuccess, onCancel, initialRecord, showCompletionActions, scheduleReturnTo }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialRecord ? recordToFormState(initialRecord) : DEFAULT_FORM
  );
  /** 保存直後に作成された id（新規の場合 initialRecord が null なので表示制御に使う） */
  const [savedRecordId, setSavedRecordId] = useState<string | null>(initialRecord?.id ?? null);
  const [uploading, setUploading] = useState(false);
  /** 受付OCRの結果（intake-primary: success / partial / timeout / error を必ず表示） */
  const [ocrStage, setOcrStage] = useState<"start" | "extracting" | "success" | "partial" | "timeout" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** /api/cases への保存結果（成功・失敗メッセージ） */
  const [apiSaveResult, setApiSaveResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  /** 登録処理中フラグ（ボタン文言・二重送信防止） */
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** 保存成功を分かりやすく伝える短時間トースト */
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [nearbySuggestions, setNearbySuggestions] = useState<VisitEfficiencySuggestionItem[]>([]);
  /** 設定ユーザーのロールに基づく訪問効率提案の表示可否（サーバー `/api/auth/me`） */
  const [visitEfficiencyAllowed, setVisitEfficiencyAllowed] = useState<boolean | null>(null);
  /** 訪問効率提案パネル（ボタン押下で表示） */
  const [visitEfficiencyOpen, setVisitEfficiencyOpen] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const canShowVisitEfficiency = useMemo(
    () =>
      visitEfficiencyAllowed === true &&
      form.status !== "visit_confirmed" &&
      !!(form.address ?? "").trim() &&
      !!(form.desiredVisitDate ?? "").trim(),
    [visitEfficiencyAllowed, form.status, form.address, form.desiredVisitDate]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setVisitEfficiencyAllowed(false);
          return;
        }
        return res.json() as Promise<{ visitEfficiencyAllowed?: boolean }>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setVisitEfficiencyAllowed(!!data.visitEfficiencyAllowed);
      })
      .catch(() => {
        if (!cancelled) setVisitEfficiencyAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const address = (form.address ?? "").trim();
    const desiredVisitDate = (form.desiredVisitDate ?? "").trim();
    if (
      visitEfficiencyAllowed !== true ||
      !address ||
      !desiredVisitDate ||
      form.status === "visit_confirmed"
    ) {
      setNearbySuggestions([]);
      setNearbyLoading(false);
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      if (cancelled) return;
      setNearbyLoading(true);
      try {
        const addressUnchanged =
          (initialRecord?.address ?? "").trim() === address &&
          initialRecord?.lat != null &&
          initialRecord?.lng != null;
        const currentId = (savedRecordId ?? initialRecord?.id ?? "").trim();
        const zip = (form.postalCode ?? "").replace(/\D/g, "").slice(0, 7);
        const res = await fetch("/api/cases/visit-efficiency-nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            address,
            postalCode: zip,
            excludeCaseId: currentId,
            savedLat: initialRecord?.lat != null ? Number(initialRecord.lat) : null,
            savedLng: initialRecord?.lng != null ? Number(initialRecord.lng) : null,
            addressMatchesSaved: addressUnchanged,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          featureVisible?: boolean;
          items?: VisitEfficiencySuggestionItem[];
        };
        if (cancelled) return;
        if (!res.ok || data?.ok === false || data?.featureVisible === false) {
          setNearbySuggestions([]);
          return;
        }
        setNearbySuggestions(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setNearbySuggestions([]);
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      setNearbyLoading(false);
    };
  }, [
    form.address,
    form.desiredVisitDate,
    form.postalCode,
    form.status,
    initialRecord?.address,
    initialRecord?.id,
    initialRecord?.lat,
    initialRecord?.lng,
    savedRecordId,
    visitEfficiencyAllowed,
  ]);

  useEffect(() => {
    if (!canShowVisitEfficiency) setVisitEfficiencyOpen(false);
  }, [canShowVisitEfficiency]);

  /** Mock 時など、信頼度・座標付きの OCR 結果（詳細パネル表示用） */
  const [ocrMeta, setOcrMeta] = useState<{ mock: boolean; mapping: import("@/lib/ocr-types").OcrFieldMapping } | null>(null);
  /** 選択中PDFのプレビュー用オブジェクトURL（添付どれを選んでもそのPDFを表示するため） */
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfPreviewUrlRef = useRef<string | null>(null);
  /** 直近OCRに使用したPDFファイル名（「この内容で学習登録」時に送信） */
  const [lastOcrPdfFileName, setLastOcrPdfFileName] = useState<string | null>(null);
  /** 学習データ保存結果（この内容で学習登録） */
  const [trainingDataSaveResult, setTrainingDataSaveResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [trainingDataSaving, setTrainingDataSaving] = useState(false);
  const [casesAssistantOpen, setCasesAssistantOpen] = useState(false);
  /** 過去データ検索結果（OCR後の自動反映パネル用） */
  const [pastDataResult, setPastDataResult] = useState<{
    requester?: { shop_name: string; shop_phone: string; shop_address: string; updated_at: string };
    customer?: { customer_name: string; customer_phone: string; customer_address: string; updated_at: string };
    filledFields: string[];
    requester_id?: string;
    customer_id?: string;
  } | null>(null);
  /** 過去データ反映時のスナップショット（登録時に「更新しますか」判定用） */
  const pastDataSnapshotRef = useRef<{
    requester_id: string;
    customer_id: string;
    shop_name: string;
    shop_phone: string;
    shop_address: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
  } | null>(null);
  /** 「過去データと異なります。更新しますか？」モーダル */
  const [showPastDataUpdateModal, setShowPastDataUpdateModal] = useState(false);
  const [pastDataUpdateResolve, setPastDataUpdateResolve] = useState<((choice: "update" | "skip") => void) | null>(null);
  const [showDuplicateReceptionModal, setShowDuplicateReceptionModal] = useState(false);
  const [duplicateReceptionNo, setDuplicateReceptionNo] = useState<string | null>(null);
  /** Dify 受付ナレッジチェック結果（PDF転記完了後に表示） */
  const [receptionCheckResult, setReceptionCheckResult] = useState<{ status: "ok" | "warning" | "error"; message: string } | null>(null);
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
  const completionDetailFormRef = useRef<CompletionDetailFormHandle | null>(null);
  /** 「上記内容で登録」押下時に true にし、handleSubmit 内で unconfirmed_fields を付与 */
  const submitAsUnconfirmedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  /** JS制御の点滅表示フラグ（請求書発行案内） */
  const [billingBlinkVisible, setBillingBlinkVisible] = useState(true);

  /** 必須項目のうち未入力の項目名一覧 */
  const missingRequiredLabels = useMemo(() => {
    return REQUIRED_FIELDS.filter((f) => !isRequiredFilled(form[f.key])).map((f) => f.label);
  }, [form.receptionNo, form.requestStoreName, form.requestPhone, form.customerName, form.address, form.phone, form.inquiryContent]);
  const isAllRequiredFilled = missingRequiredLabels.length === 0;

  /** 支払方法が「現地請求（依頼元へ請求書発行）」かつ依頼元住所が空のときは依頼元住所必須エラー */
  const requesterAddressRequiredForBilling = useMemo(() => {
    return form.paymentMethod === "現地請求（依頼元へ請求書発行）" && !(form.requestAddress ?? "").trim();
  }, [form.paymentMethod, form.requestAddress]);
  const isLocalBilling = (form.paymentMethod ?? "").includes("現地請求");
  const isSpecifiedBilling = form.paymentMethod === "現地請求（指定先別途請求書発行）";
  const missingRequestSpecifiedNo = !(form.requestSpecifiedNo ?? "").trim();
  const missingBillingName = !(form.billingName ?? "").trim();
  const missingBillingPostalCode = !(form.billingPostalCode ?? "").trim();
  const missingBillingAddress = !(form.billingAddress ?? "").trim();
  const missingBillingMemo = !(form.memo ?? "").trim();
  /** 支払方法で現地請求を選択し、かつ赤枠対象に未入力がある場合のみ案内表示 */
  const billingNoticeRequired = useMemo(() => {
    if (!isLocalBilling) return false;
    if (!isSpecifiedBilling) return missingRequestSpecifiedNo;
    return (
      missingRequestSpecifiedNo ||
      missingBillingName ||
      missingBillingPostalCode ||
      missingBillingAddress ||
      missingBillingMemo
    );
  }, [
    isLocalBilling,
    isSpecifiedBilling,
    missingRequestSpecifiedNo,
    missingBillingName,
    missingBillingPostalCode,
    missingBillingAddress,
    missingBillingMemo,
  ]);

  useEffect(() => {
    if (!billingNoticeRequired) {
      setBillingBlinkVisible(true);
      return;
    }
    const timer = window.setInterval(() => {
      setBillingBlinkVisible((prev) => !prev);
    }, 550);
    return () => window.clearInterval(timer);
  }, [billingNoticeRequired]);

  useEffect(() => {
    fetch("/api/settings/user-names")
      .then((res) => res.json())
      .then((data: { names?: string[] }) => {
        const names = Array.isArray(data?.names) ? data.names.filter((n) => typeof n === "string" && n.trim()) : [];
        setAssigneeOptions(names.length > 0 ? names : getAssigneeNames());
      })
      .catch(() => setAssigneeOptions(getAssigneeNames()));
  }, []);

  /** 同じ依頼元の直近案件からメールアドレスを自動入力 */
  useEffect(() => {
    const name = (form.requestStoreName ?? "").trim();
    if (!name || (form.requestStoreEmail ?? "").trim()) return;
    void (async () => {
      const all = await getAllCases();
      const same = all
        .filter((c) => (c.requestStoreName ?? "").trim() === name && (c.requestStoreEmail ?? "").trim())
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const last = same[0];
      if (last?.requestStoreEmail?.trim()) {
        setForm((prev) => ({ ...prev, requestStoreEmail: (last.requestStoreEmail ?? "").trim() }));
      }
    })();
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

  useEffect(() => {
    pdfPreviewUrlRef.current = pdfPreviewUrl;
  }, [pdfPreviewUrl]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = null;
      }
    };
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.type !== "application/pdf") {
        setError("PDFファイルを選択してください");
        return;
      }
      setError(null);
      setReceptionCheckResult(null);
      setUploading(true);
      setOcrStage("start");
      setOcrMeta(null);
      // OCR結果に関わらず、選択直後からPDFを確認できるようにする
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setLastOcrPdfFileName(file.name);

      try {
        setOcrStage("extracting");
        const fd = new FormData();
        fd.append("file", file, file.name);

        const res = await fetchWithTimeout(
          "/api/ocr/intake-primary",
          { method: "POST", body: fd },
          INTAKE_PRIMARY_TIMEOUT_MS,
          "intake-primary"
        );
        const data = (await res.json()) as {
          success?: boolean;
          formData?: OcrResult;
          error?: string;
          status?: "success" | "error";
        };

        const formData = data.formData;
        const reception_no = (formData?.receptionNo ?? "").trim();
        const model = (formData?.modelName ?? formData?.model_candidate ?? "").trim();
        const customer_name = (formData?.customerName ?? "").trim();
        const inquiry_raw = (formData?.inquiry_raw ?? formData?.inquiryContent ?? "").trim();

        console.log("[CaseForm OCR] 4項目 raw reception_no=", JSON.stringify(reception_no));
        console.log("[CaseForm OCR] 4項目 raw model=", JSON.stringify(model));
        console.log("[CaseForm OCR] 4項目 raw customer_name=", JSON.stringify(customer_name));
        console.log("[CaseForm OCR] 4項目 raw inquiry_raw=", JSON.stringify(inquiry_raw.slice(0, 100)) + (inquiry_raw.length > 100 ? "…" : ""));

        const hasAny = !!(reception_no || model || customer_name || inquiry_raw);
        if (formData && hasAny) {
          applyOcr(formData);

          // 受付ナレッジチェック用のマージ済みペイロード（過去データ反映後）
          let receptionCheckPayload: {
            reception_no: string;
            shop_name: string;
            shop_phone: string;
            shop_fax: string;
            shop_address: string;
            shop_manager: string;
            customer_name: string;
            customer_address: string;
            customer_phone: string;
            model: string;
            inquiry: string;
            internal_note: string;
          } = {
            reception_no: formData.receptionNo?.trim() ?? "",
            shop_name: formData.requestStoreName?.trim() ?? "",
            shop_phone: formData.requestPhone?.trim() ?? "",
            shop_fax: formData.requestFax?.trim() ?? "",
            shop_address: formData.requestAddress?.trim() ?? "",
            shop_manager: formData.requestContactName?.trim() ?? "",
            customer_name: formData.customerName?.trim() ?? "",
            customer_address: formData.address?.trim() ?? "",
            customer_phone: formData.phone?.trim() ?? "",
            model: formData.modelName?.trim() ?? "",
            inquiry: (formData.inquiryContent ?? formData.inquiry_raw ?? "").trim(),
            internal_note: formData.internalContact?.trim() ?? "",
          };

          // 過去データ検索（依頼元・お客様の自動反映）
          try {
            const searchRes = await fetch("/api/past-data/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reception_no: formData.receptionNo?.trim() || undefined,
                shop_name: formData.requestStoreName?.trim() || undefined,
                shop_phone: formData.requestPhone?.trim() || undefined,
                customer_name: formData.customerName?.trim() || undefined,
                customer_phone: formData.phone?.trim() || undefined,
                address: formData.address?.trim() || undefined,
              }),
            });
            const searchData = (await searchRes.json()) as {
              matched?: boolean;
              requester?: { id: string; shop_name: string; shop_phone: string; shop_address: string; updated_at: string };
              customer?: { id: string; customer_name: string; customer_phone: string; customer_address: string; updated_at: string };
              filledFields?: string[];
            };
            if (searchData?.matched && (searchData.requester || searchData.customer)) {
              setForm((prev) => ({
                ...prev,
                requestStoreName: searchData.requester?.shop_name ?? prev.requestStoreName,
                requestPhone: searchData.requester?.shop_phone ?? prev.requestPhone,
                requestAddress: searchData.requester?.shop_address ?? prev.requestAddress,
                customerName: searchData.customer?.customer_name ?? prev.customerName,
                phone: searchData.customer?.customer_phone ?? prev.phone,
                address: searchData.customer?.customer_address ?? prev.address,
              }));
              receptionCheckPayload = {
                reception_no: receptionCheckPayload.reception_no,
                shop_name: searchData.requester?.shop_name ?? receptionCheckPayload.shop_name,
                shop_phone: searchData.requester?.shop_phone ?? receptionCheckPayload.shop_phone,
                shop_fax: receptionCheckPayload.shop_fax,
                shop_address: searchData.requester?.shop_address ?? receptionCheckPayload.shop_address,
                shop_manager: receptionCheckPayload.shop_manager,
                customer_name: searchData.customer?.customer_name ?? receptionCheckPayload.customer_name,
                customer_address: searchData.customer?.customer_address ?? receptionCheckPayload.customer_address,
                customer_phone: searchData.customer?.customer_phone ?? receptionCheckPayload.customer_phone,
                model: receptionCheckPayload.model,
                inquiry: receptionCheckPayload.inquiry,
                internal_note: receptionCheckPayload.internal_note,
              };
              setPastDataResult({
                requester: searchData.requester
                  ? { shop_name: searchData.requester.shop_name, shop_phone: searchData.requester.shop_phone, shop_address: searchData.requester.shop_address ?? "", updated_at: searchData.requester.updated_at }
                  : undefined,
                customer: searchData.customer
                  ? { customer_name: searchData.customer.customer_name, customer_phone: searchData.customer.customer_phone, customer_address: searchData.customer.customer_address ?? "", updated_at: searchData.customer.updated_at }
                  : undefined,
                filledFields: searchData.filledFields ?? [],
                requester_id: searchData.requester?.id,
                customer_id: searchData.customer?.id,
              });
              pastDataSnapshotRef.current =
                searchData.requester && searchData.customer
                  ? {
                      requester_id: searchData.requester.id,
                      customer_id: searchData.customer.id,
                      shop_name: searchData.requester.shop_name,
                      shop_phone: searchData.requester.shop_phone,
                      shop_address: searchData.requester.shop_address ?? "",
                      customer_name: searchData.customer.customer_name,
                      customer_phone: searchData.customer.customer_phone,
                      customer_address: searchData.customer.customer_address ?? "",
                    }
                  : null;
            } else {
              setPastDataResult(null);
              pastDataSnapshotRef.current = null;
            }
          } catch {
            setPastDataResult(null);
            pastDataSnapshotRef.current = null;
          }

          // Dify 受付ナレッジチェック（転記完了時に自動実行・エラーでも転記は止めない）
          try {
            const checkRes = await fetch("/api/dify/reception-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(receptionCheckPayload),
            });
            const checkData = (await checkRes.json().catch(() => ({}))) as {
              status?: "ok" | "warning" | "error";
              message?: string;
            };
            setReceptionCheckResult({
              status: checkData?.status === "warning" || checkData?.status === "error" ? checkData.status : "ok",
              message: checkData?.message ?? (checkRes.ok ? "チェック完了" : "チェックに失敗しました"),
            });
          } catch {
            setReceptionCheckResult({ status: "error", message: "ナレッジチェックに接続できませんでした。" });
          }

        }

        if (data.success && formData) {
          setOcrStage("success");
        } else {
          setOcrStage("error");
          setError(data.error ?? "OCRに失敗しました");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("タイムアウト")) {
          setOcrStage("timeout");
          setError("OCRがタイムアウトしました。");
        } else {
          setOcrStage("error");
          setError(msg || "OCRに失敗しました");
        }
      } finally {
        setUploading(false);
        setOcrStage(null);
        e.target.value = "";
      }
    },
    [applyOcr]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setApiSaveResult(null);
    if (form.paymentMethod === "現地請求（依頼元へ請求書発行）" && !(form.requestAddress ?? "").trim()) {
      return;
    }
    const missingLabels = REQUIRED_FIELDS.filter((f) => !isRequiredFilled(form[f.key])).map((f) => f.label);
    const isUnconfirmedSubmit = submitAsUnconfirmedRef.current;
    submitAsUnconfirmedRef.current = false;
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
      inquiry_raw: form.inquiry_raw?.trim() || undefined,
      model_candidate: form.model_candidate?.trim() || undefined,
      symptom: form.symptom?.trim() || undefined,
      usage_years_note: form.usage_years_note?.trim() || undefined,
      contact_datetime_note: form.contact_datetime_note?.trim() || undefined,
      preferred_visit_note: form.preferred_visit_note?.trim() || undefined,
      fee_explanation_note: form.fee_explanation_note?.trim() || undefined,
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
    const requesterEmpty = !(form.requestStoreName?.trim() || form.requestPhone?.trim());
    if (isUnconfirmedSubmit && missingLabels.length > 0) {
      const uf = [...missingLabels];
      if (requesterEmpty && !uf.includes("依頼元情報未確認")) uf.push("依頼元情報未確認");
      (payload as { unconfirmed_fields?: string[] }).unconfirmed_fields = uf;
    } else if (requesterEmpty) {
      (payload as { unconfirmed_fields?: string[] }).unconfirmed_fields = ["依頼元情報未確認"];
    }

    // 過去データと異なる内容で登録する場合の確認
    const snapshot = pastDataSnapshotRef.current;
    if (snapshot) {
      const differs =
        (payload.requestStoreName ?? "") !== snapshot.shop_name ||
        (payload.requestPhone ?? "") !== snapshot.shop_phone ||
        (payload.requestAddress ?? "") !== snapshot.shop_address ||
        (payload.customerName ?? "") !== snapshot.customer_name ||
        (payload.phone ?? "") !== snapshot.customer_phone ||
        (payload.address ?? "") !== snapshot.customer_address;
      if (differs) {
        const choice = await new Promise<"update" | "skip">((resolve) => {
          setShowPastDataUpdateModal(true);
          setPastDataUpdateResolve(() => resolve);
        });
        setShowPastDataUpdateModal(false);
        setPastDataUpdateResolve(null);
        if (choice === "update") {
          try {
            await fetch("/api/past-data/update", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requester_id: snapshot.requester_id,
                customer_id: snapshot.customer_id,
                shop_name: payload.requestStoreName ?? "",
                shop_phone: payload.requestPhone ?? "",
                shop_address: payload.requestAddress ?? "",
                customer_name: payload.customerName ?? "",
                customer_phone: payload.phone ?? "",
                customer_address: payload.address ?? "",
              }),
            });
          } catch (err) {
            console.error("[CaseForm] past-data update failed", err);
          }
        }
        pastDataSnapshotRef.current = null;
      }
    }

    let unconfirmedForApi: string[] | undefined;
    try {
      if (initialRecord?.id) {
        type CaseUpdatePayload = Partial<Omit<CaseRecord, "id" | "createdAt" | "updatedAt">>;
        let finalPayload: CaseUpdatePayload = payload;
        if (form.status === "completed" && completionDetailFormRef.current) {
          const detailRaw = completionDetailFormRef.current.getDetail();
          const completionPayload = completionDetailFormRef.current.getCompletionPayload?.();
          if (completionPayload && detailRaw) {
            detailRaw.part_number = completionPayload.completionPartsPartNo ?? detailRaw.part_number;
            detailRaw.part_name = completionPayload.completionPartsUsed ?? detailRaw.part_name;
          }
          const errs = validateCompletionDetail(detailRaw);
          if (detailRaw && ((detailRaw.model ?? "").trim() || (detailRaw.solution_summary ?? "").trim()) && errs.length > 0) {
            completionDetailFormRef.current.setErrors(errs);
            setError("完了詳細の必須項目を入力してください。");
            return;
          }
          if (detailRaw && ((detailRaw.model ?? "").trim() || (detailRaw.solution_summary ?? "").trim())) {
            finalPayload = {
              ...payload,
              ...(completionPayload ?? {}),
              completionDetail: buildCompletionDetail(detailRaw, { is_completed: true }),
            };
          }
        } else if (form.status === "completed" && completionFormRef.current) {
          finalPayload = { ...payload, ...completionFormRef.current.getCompletionPayload() };
        }
        // 追記で不足情報が埋まったら unconfirmed_fields から該当項目を削除
        const stillMissing = (initialRecord.unconfirmed_fields ?? []).filter((label) => {
          if (label === "依頼元情報未確認") return !(form.requestStoreName?.trim() || form.requestPhone?.trim());
          const f = REQUIRED_FIELDS.find((r) => r.label === label);
          return f && !isRequiredFilled(form[f.key]);
        });
        const requesterEmptyEdit = !(form.requestStoreName?.trim() || form.requestPhone?.trim());
        if (requesterEmptyEdit && !stillMissing.includes("依頼元情報未確認")) stillMissing.push("依頼元情報未確認");
        (finalPayload as { unconfirmed_fields?: string[] }).unconfirmed_fields = stillMissing.length > 0 ? stillMissing : undefined;
        await updateCase(initialRecord.id, finalPayload);
        unconfirmedForApi = stillMissing.length > 0 ? stillMissing : undefined;
        const completionDetail = (finalPayload as { completionDetail?: import("@/lib/types").CompletionDetail }).completionDetail;
        const shouldSyncDify = completionDetail && !initialRecord.difySynced;
        if (shouldSyncDify) {
          const text = formatCompletionDetailForDify(completionDetail);
          const name = buildDifyDocumentName({
            receptionNo: initialRecord.receptionNo,
            caseId: initialRecord.id,
            model: completionDetail.model,
            symptomCategory: completionDetail.symptom_category,
          });
          const currentHash = await sha256Hex(text);
          const unchanged = currentHash && currentHash === initialRecord.difyContentHash;
          if (!unchanged) {
            try {
              const res = await fetch("/api/dify/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text,
                  name,
                  documentId: initialRecord.difyDocumentId ?? undefined,
                  processRuleMode: "completion_single_chunk",
                }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                status?: number;
                documentId?: string;
                contentHash?: string;
                error?: string;
                indexingStatus?: string;
                difyResponse?: { code?: string; message?: string };
              };
              const now = new Date().toISOString();
              if (data?.ok === true) {
                await updateCase(initialRecord.id, {
                  difySynced: true,
                  difySyncedAt: now,
                  difyDocumentId: data.documentId ?? null,
                  difySyncError: null,
                  difyContentHash: data.contentHash ?? null,
                });
              } else {
                const statusCode = data?.status ?? res.status;
                const code = data?.difyResponse?.code ?? "—";
                const msg = data?.difyResponse?.message ?? data?.error ?? "不明";
                const errMsg = `HTTP ${statusCode} | Dify code: ${code} | ${msg}`;
                await updateCase(initialRecord.id, {
                  difySynced: false,
                  difySyncError: errMsg,
                });
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : "送信に失敗しました";
              await updateCase(initialRecord.id, {
                difySynced: false,
                difySyncError: errMsg,
              });
            }
          }
        }
        const wasNotCompleted = initialRecord.status !== "completed";
        const partsRowsForOutbound =
          form.status === "completed" && completionDetailFormRef.current?.getPartsRowsForOutbound
            ? completionDetailFormRef.current.getPartsRowsForOutbound()
            : form.status === "completed" && completionFormRef.current
              ? completionFormRef.current.getPartsRowsForOutbound()
              : [];
        if (wasNotCompleted && form.status === "completed" && partsRowsForOutbound.length > 0) {
          const rows = partsRowsForOutbound;
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
        let newPayload: Parameters<typeof addCase>[0] = payload;
        if (form.status === "completed" && completionDetailFormRef.current) {
          const detailRaw = completionDetailFormRef.current.getDetail();
          const completionPayload = completionDetailFormRef.current.getCompletionPayload?.();
          if (completionPayload && detailRaw) {
            detailRaw.part_number = completionPayload.completionPartsPartNo ?? detailRaw.part_number;
            detailRaw.part_name = completionPayload.completionPartsUsed ?? detailRaw.part_name;
          }
          const errs = validateCompletionDetail(detailRaw ?? {});
          if (detailRaw && ((detailRaw.model ?? "").trim() || (detailRaw.solution_summary ?? "").trim())) {
            if (errs.length > 0) {
              completionDetailFormRef.current.setErrors(errs);
              setError("完了詳細の必須項目を入力してください。");
              return;
            }
            newPayload = {
              ...payload,
              ...(completionPayload ?? {}),
              completionDetail: buildCompletionDetail(detailRaw, { is_completed: true }),
            };
          }
        }
        const created = await addCase(newPayload);
        if (!created) {
          setError("案件の保存に失敗しました。");
          return;
        }
        unconfirmedForApi = created.unconfirmed_fields;
        setSavedRecordId(created.id);
        onSuccess?.(created.id);
        // 新規登録で完了かつ使用部品がある場合も出庫・車載在庫減算（更新時と同様）
        if (form.status === "completed") {
          const partsRowsForOutboundNew =
            completionDetailFormRef.current?.getPartsRowsForOutbound
              ? completionDetailFormRef.current.getPartsRowsForOutbound()
              : completionFormRef.current
                ? completionFormRef.current.getPartsRowsForOutbound()
                : [];
          if (partsRowsForOutboundNew.length > 0) {
            const outboundPerson = form.assignedTo?.trim() || getDefaultOutboundHandlerName();
            const today = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            })();
            for (const row of partsRowsForOutboundNew) {
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
        }
        // 過去データテーブルに保存（次回OCR時の自動反映用）
        try {
          const saveRes = await fetch("/api/past-data/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reception_no: form.receptionNo?.trim() || undefined,
              shop_name: form.requestStoreName?.trim() || undefined,
              shop_phone: form.requestPhone?.trim() || undefined,
              shop_address: form.requestAddress?.trim() || undefined,
              customer_name: form.customerName?.trim() || undefined,
              customer_phone: form.phone?.trim() || undefined,
              customer_address: form.address?.trim() || undefined,
            }),
          });
          const saveData = (await saveRes.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            message?: string;
            reception_no?: string;
          };
          if (saveData?.ok === false && saveData?.error === "duplicate") {
            setDuplicateReceptionNo(saveData.reception_no ?? form.receptionNo?.trim() ?? "");
            setShowDuplicateReceptionModal(true);
          }
        } catch {
          // 過去データ保存失敗は登録成功を妨げない
        }
      }
      if (initialRecord?.id) {
        setSavedRecordId(initialRecord.id);
        onSuccess?.(initialRecord.id);
      }

      // 既存UIはそのままに、/api/cases へも保存（Turso）＋ Dify ナレッジ連携
      const repairKnowledgeExtras: Record<string, string | undefined> = {};
      if (form.status === "completed") {
        let workDetail = "";
        const usedPartsLines: string[] = [];
        if (completionDetailFormRef.current) {
          const d = completionDetailFormRef.current.getDetail();
          workDetail = (d.work_detail ?? "").trim();
          const rows = completionDetailFormRef.current.getPartsRowsForOutbound?.() ?? [];
          for (const row of rows) {
            const pn = (row.partNo ?? "").trim();
            if (!pn) continue;
            const qty = row.qty > 1 ? ` ×${row.qty}` : "";
            const name = (row.partName ?? "").trim();
            usedPartsLines.push(`${pn}${qty}${name ? ` ${name}` : ""}`.trim());
          }
          const singlePn = (d.part_number ?? "").trim();
          const singleName = (d.part_name ?? "").trim();
          if (usedPartsLines.length === 0 && (singlePn || singleName)) {
            usedPartsLines.push([singlePn, singleName].filter(Boolean).join(" "));
          }
        } else if (completionFormRef.current) {
          const p = completionFormRef.current.getCompletionPayload();
          workDetail = (p.completionRepairDetail ?? "").trim();
          const rows = completionFormRef.current.getPartsRowsForOutbound();
          for (const row of rows) {
            const pn = (row.partNo ?? "").trim();
            if (!pn) continue;
            const qty = row.qty > 1 ? ` ×${row.qty}` : "";
            const name = (row.partName ?? "").trim();
            usedPartsLines.push(`${pn}${qty}${name ? ` ${name}` : ""}`.trim());
          }
        }
        repairKnowledgeExtras.case_status = "completed";
        repairKnowledgeExtras.completion_date = new Date().toISOString();
        repairKnowledgeExtras.work_detail = workDetail || undefined;
        repairKnowledgeExtras.used_parts_text =
          usedPartsLines.length > 0 ? usedPartsLines.join("\n") : undefined;
      }

      // ここまでの addCase/updateCase で /api/cases への保存は完了済み。
      // 旧互換の再POSTは既存項目（例: assignedTo）を欠落させて上書きするため行わない。
      void repairKnowledgeExtras;
      void unconfirmedForApi;
      setApiSaveResult({ status: "success", message: "登録しました" });
      setShowSavedToast(true);
      window.setTimeout(() => setShowSavedToast(false), 2500);

    } catch (err) {
      setError(err instanceof Error ? err.message : (initialRecord ? "更新に失敗しました" : "登録に失敗しました"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 手修正内容を学習データとして保存（Turso: 代表の part_number/part_name + used_parts_json／Dify: formatCompletionDetailForDify） */
  const handleSaveTrainingData = useCallback(async () => {
    setTrainingDataSaveResult(null);
    setTrainingDataSaving(true);
    try {
      const detail =
        form.status === "completed" ? completionDetailFormRef.current?.getDetail() : undefined;
      const usedPartsRows =
        form.status === "completed"
          ? completionDetailFormRef.current?.getPartsRowsForOutbound?.() ?? []
          : [];
      const payload = {
        pdf_file_name: lastOcrPdfFileName ?? "unknown.pdf",
        model: form.modelName ?? "",
        model_display: form.reportedModelName ?? "",
        gas_type: form.gasType ?? "",
        received_at: form.receptionDate ?? "",
        warranty: form.warranty ?? "",
        payment: form.paymentMethod ?? "",
        symptom_category: detail?.symptom_category ?? "",
        confirmed_cause: detail?.confirmed_cause ?? "",
        solution_summary: detail?.solution_summary ?? "",
        part_number: detail?.part_number ?? "",
        part_name: detail?.part_name ?? "",
        work_result: detail?.work_result ?? "",
        used_parts_json: JSON.stringify(usedPartsRows),
      };
      const res = await fetch("/api/ocr-training-data", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        dify?: { ok: true; documentId: string } | { ok: false; message: string };
      };
      if (data?.ok === true) {
        const difyOk = data.dify?.ok === true;
        const difyMsg = data.dify?.ok === false ? ` ${data.dify.message}` : "";
        setTrainingDataSaveResult({
          status: difyOk ? "success" : "error",
          message: difyOk
            ? "学習データを保存し、ナレッジに登録しました。"
            : `Tursoには保存しましたが、ナレッジ登録に失敗しました。${difyMsg}`,
        });
      } else {
        setTrainingDataSaveResult({ status: "error", message: data?.error ?? "保存に失敗しました。" });
      }
    } catch (err) {
      setTrainingDataSaveResult({
        status: "error",
        message: err instanceof Error ? err.message : "保存に失敗しました。",
      });
    } finally {
      setTrainingDataSaving(false);
    }
  }, [form, lastOcrPdfFileName]);

  /** 学習データをCSVでダウンロード（Studio インポート用） */
  const handleExportTrainingDataCsv = useCallback(async () => {
    try {
      const res = await fetch("/api/ocr-training-data/export", { credentials: "include" });
      if (!res.ok) throw new Error("エクスポートに失敗しました");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `ocr-training-data-${new Date().toISOString().slice(0, 10)}.csv`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setTrainingDataSaveResult({
        status: "error",
        message: err instanceof Error ? err.message : "CSVのダウンロードに失敗しました。",
      });
    }
  }, []);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  }, []);

  const autofillAddressFromPostal = useCallback(
    async (
      postalCode: string,
      currentAddress: string,
      target: "address" | "requestAddress" | "billingAddress"
    ) => {
      const zip = (postalCode ?? "").replace(/\D/g, "").slice(0, 7);
      if (zip.length !== 7) return;
      if ((currentAddress ?? "").trim()) return;
      try {
        const res = await fetch(`/api/postal-lookup?zipcode=${encodeURIComponent(zip)}`);
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; address?: string };
        const addr = (data?.address ?? "").trim();
        if (!res.ok || !data?.ok || !addr) return;
        setForm((prev) => {
          if ((prev[target] ?? "").trim()) return prev;
          const nextAddress = target === "requestAddress" ? cleanAddressForTranscribe(addr) : addr;
          return { ...prev, [target]: nextAddress };
        });
      } catch {
        // 郵便番号補完失敗は無視（手入力を優先）
      }
    },
    []
  );

  const getRequiredErrorClass = (key: (typeof REQUIRED_FIELDS)[number]["key"]) =>
    missingRequiredLabels.includes(REQUIRED_FIELDS.find((f) => f.key === key)?.label ?? "")
      ? " border-red-500 ring-1 ring-red-500"
      : "";

  /** 過去データより反映した項目に表示するバッジ（APIの項目名で判定） */
  const pastDataBadge = (apiLabel: string) =>
    pastDataResult?.filledFields.includes(apiLabel) ? (
      <span className="ml-1 inline-block rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-200">📋 過去データより</span>
    ) : null;

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
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
      {billingNoticeRequired && (
        <p
          className="text-sm font-medium text-red-700 dark:text-red-300"
          style={{ opacity: billingBlinkVisible ? 1 : 0.2 }}
        >
          請求書発行は下記の入力をして下さい。
        </p>
      )}
      {/* 不足項目が1つでもある場合のみ警告ボックスを表示。表示するのは実際に未入力の項目だけ。全項目入力済みなら非表示。 */}
      {missingRequiredLabels.length > 0 ? (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm">
          <p className="font-medium text-red-800 dark:text-red-200">
            ⚠️ 以下の項目が未入力です。依頼元もしくは、現場のお客様にヒヤリングして下さい。
          </p>
          <ul className="mt-2 list-inside list-disc text-red-700 dark:text-red-300">
            {missingRequiredLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {/* 新規受付のみ PDF OCR。追加入力・更新（編集）時は非表示 */}
      {!initialRecord?.id && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            PDFで自動転記（出張修理依頼書）
          </label>
          <p className="text-[var(--muted)]">
            PDFをアップロードすると書類OCRで項目を自動転記します。手入力も可能です。
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-[var(--primary-foreground)] file:text-sm"
            />
            {pdfPreviewUrl && (
              <a
                href={pdfPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--card)]"
              >
                PDF確認
              </a>
            )}
          </div>
          {uploading && (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--primary)]">
              {ocrStage === "start" && "OCR開始"}
              {ocrStage === "extracting" && "読込中"}
              {ocrStage === "extracting" && (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-label="loading"
                />
              )}
              {ocrStage === "success" && "読込完了"}
              {ocrStage === "partial" && "一部のみ転記"}
              {ocrStage === "error" && "エラー"}
              {ocrStage === "timeout" && "タイムアウト"}
              {uploading && !ocrStage && "OCR開始"}
            </p>
          )}
        </div>
      )}

      {pastDataResult && (pastDataResult.requester || pastDataResult.customer) && (
        <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--card)] p-4 space-y-3">
          <p className="font-semibold text-[var(--foreground)]">📋 過去のデータが見つかりました</p>
          {pastDataResult.requester && (
            <p className="text-sm text-[var(--muted)]">
              依頼元：{pastDataResult.requester.shop_name}
              （{pastDataResult.requester.updated_at.slice(0, 10).replace(/-/g, "/")} 登録）
            </p>
          )}
          {pastDataResult.customer && (
            <p className="text-sm text-[var(--muted)]">
              お客様：{pastDataResult.customer.customer_name}
              （{pastDataResult.customer.updated_at.slice(0, 10).replace(/-/g, "/")} 登録）
            </p>
          )}
          <p className="text-sm text-[var(--foreground)]">以下の項目を自動反映しました：</p>
          <ul className="list-inside list-disc text-sm text-[var(--muted)]">
            {pastDataResult.filledFields.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPastDataResult(null)}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            >
              この内容で進む
            </button>
            <button
              type="button"
              onClick={() => setPastDataResult(null)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              修正する
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--alert)] bg-[var(--alert-bg)] px-4 py-3 text-sm text-[var(--alert)]">
          {error}
        </div>
      )}

      {/* OCR 結果詳細（Mock 時など mapping がある場合: プレビュー・抽出一覧・信頼度・座標） */}
      {ocrMeta?.mapping && (
        <OcrResultPanel mapping={ocrMeta.mapping} isMock={ocrMeta.mock} previewUrl={pdfPreviewUrl} />
      )}

      {/* 修理受付・依頼元 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          修理受付・依頼元
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">修理受付番号</span>
            <div className={`mt-1 flex min-w-0 items-center gap-1 rounded-lg border bg-[var(--background)] px-1 py-1${getRequiredErrorClass("receptionNo") || " border-[var(--border)]"}`}>
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
            {pastDataBadge("ご依頼店名")}
            <input type="text" value={form.requestStoreName} onChange={(e) => set("requestStoreName", e.target.value)} className={inputClass + getRequiredErrorClass("requestStoreName")} />
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
            {pastDataBadge("依頼元電話番号")}
            <div className="flex gap-2 items-center">
              <a href={`tel:${form.requestPhone.replace(/\D/g, "")}`} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline whitespace-nowrap">
                電話をかける
              </a>
              <input type="tel" value={form.requestPhone} onChange={(e) => set("requestPhone", e.target.value)} className={inputClass + " flex-1 min-w-0" + getRequiredErrorClass("requestPhone")} placeholder="0448610072" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">FAX番号（依頼店）</span>
            <input type="tel" value={form.requestFax} onChange={(e) => set("requestFax", e.target.value)} className={inputClass} placeholder="0448610073" />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">依頼元郵便番号</span>
              <input
                type="text"
                placeholder="2160006"
                value={form.requestPostalCode}
                onChange={(e) => set("requestPostalCode", e.target.value)}
                onBlur={() => void autofillAddressFromPostal(form.requestPostalCode, form.requestAddress, "requestAddress")}
                className={inputClass}
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">御社指定No</span>
              <input
                type="text"
                value={form.requestSpecifiedNo}
                onChange={(e) => set("requestSpecifiedNo", e.target.value)}
                className={`${inputClass}${billingNoticeRequired && missingRequestSpecifiedNo && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">報告用メールアドレス</span>
              <input type="email" inputMode="email" autoComplete="email" placeholder="依頼元のメールアドレス" value={form.requestStoreEmail} onChange={(e) => set("requestStoreEmail", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">依頼元住所</span>
            {pastDataBadge("依頼元住所")}
            <input
              type="text"
              value={form.requestAddress}
              onChange={(e) => set("requestAddress", cleanAddressForTranscribe(e.target.value))}
              className={`${inputClass}${requesterAddressRequiredForBilling && !(form.requestAddress ?? "").trim() && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
            />
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
            <DateTextInput placeholder="2026/03/11" value={form.receptionDate} onChange={(e) => set("receptionDate", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">訪問希望日</span>
            <DateTextInput placeholder="03/16" value={form.desiredVisitDate} onChange={(e) => set("desiredVisitDate", e.target.value)} className={inputClass} />
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
                <input
                  type="text"
                  value={form.billingName}
                  onChange={(e) => set("billingName", e.target.value)}
                  className={`${inputClass}${billingNoticeRequired && missingBillingName && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
                  placeholder="宛名を入力"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--foreground)]">郵便番号</span>
                <input
                  type="text"
                  placeholder="2160006"
                  value={form.billingPostalCode}
                  onChange={(e) => set("billingPostalCode", e.target.value)}
                  onBlur={() => void autofillAddressFromPostal(form.billingPostalCode, form.billingAddress, "billingAddress")}
                  className={`${inputClass}${billingNoticeRequired && missingBillingPostalCode && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-[var(--foreground)]">住所</span>
                <input
                  type="text"
                  value={form.billingAddress}
                  onChange={(e) => set("billingAddress", e.target.value)}
                  className={`${inputClass}${billingNoticeRequired && missingBillingAddress && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-[var(--foreground)]">請求時の注意事項</span>
                <textarea
                  rows={3}
                  value={form.memo}
                  onChange={(e) => set("memo", e.target.value)}
                  className={`${inputClass}${billingNoticeRequired && missingBillingMemo && billingBlinkVisible ? " border-2 border-red-500" : ""}`}
                  placeholder="請求時の注意事項を入力"
                />
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
            {pastDataBadge("お客様名")}
            <input type="text" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className={inputClass + getRequiredErrorClass("customerName")} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">ﾌﾘｶﾞﾅ（お客様）</span>
            <input type="text" value={form.customerFurigana} onChange={(e) => set("customerFurigana", e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">郵便番号</span>
            <input
              type="text"
              placeholder="2160006"
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
              onBlur={() => void autofillAddressFromPostal(form.postalCode, form.address, "address")}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">住所</span>
            {pastDataBadge("お客様住所")}
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              <input type="text" value={form.address} onChange={(e) => set("address", cleanAddressForTranscribe(e.target.value))} className={inputClass + " flex-1 min-w-0" + getRequiredErrorClass("address")} />
              <button type="button" onClick={openAddressMap} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] whitespace-nowrap">
                地図を確認する
              </button>
              <button
                type="button"
                onClick={() => openNavWithCurrentLocation()}
                disabled={navLoading}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  form.address.trim() || form.postalCode.trim()
                    ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-60"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-60"
                }`}
              >
                {navLoading ? "現在地を取得中…" : "ナビを起動"}
              </button>
              {navError && (
                <p className="w-full text-sm text-red-600 mt-0.5">{navError}</p>
              )}
            </div>
          </label>
          {canShowVisitEfficiency && (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => setVisitEfficiencyOpen((o) => !o)}
                className="rounded-lg border border-orange-400 bg-orange-100/80 px-3 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-200/80 dark:border-orange-600 dark:bg-orange-950/50 dark:text-orange-100 dark:hover:bg-orange-900/60"
              >
                {visitEfficiencyOpen ? "🗺️ 訪問効率提案を閉じる" : "🗺️ 訪問効率提案を表示"}
              </button>
            </div>
          )}
          {canShowVisitEfficiency && visitEfficiencyOpen && (
            <div className="sm:col-span-2 rounded-lg border border-orange-300 bg-orange-50/70 dark:bg-orange-950/20 px-4 py-4 space-y-3">
              <p className="text-base font-semibold text-orange-900 dark:text-orange-100">🗺️ 訪問効率提案</p>
              {nearbyLoading ? (
                <p className="text-base text-orange-900 dark:text-orange-100">近隣案件を検索しています…</p>
              ) : nearbySuggestions.length === 0 ? (
                <p className="text-base text-orange-900 dark:text-orange-100">
                  訪問日確定日の予定はありません（位置が取得できない場合も表示されません）。
                </p>
              ) : (
                <div className="divide-y divide-orange-300/70">
                  {nearbySuggestions.map((item) => {
                    const customerLabel = (() => {
                      const n = (item.customer ?? "").trim();
                      if (!n) return "お客様";
                      if (/様\s*$/.test(n)) return n;
                      return `${n}様`;
                    })();
                    return (
                      <article key={item.id} className="rounded-md border border-orange-200/90 bg-orange-100/50 dark:bg-orange-900/25 p-3 text-base text-orange-900 dark:text-orange-100 space-y-2 first:mt-0 mt-3">
                        <p><strong>{item.dateTimeText}</strong></p>
                        <p>担当：<strong>{item.assignee}</strong></p>
                        <p>{customerLabel}（型式：{item.model}）が既に予定されています。</p>
                        <p>この案件は<strong>約{item.distanceKm.toFixed(1)}km</strong>先の案件です。</p>
                        <div className="rounded-md border border-orange-300/80 bg-white/50 dark:bg-black/10 px-3 py-2">
                          <p className="font-semibold">💡 アポイント提案：</p>
                          <p>・この案件の前：<strong>{item.appointmentBefore}</strong></p>
                          <p>・この案件の後：<strong>{item.appointmentAfter}</strong></p>
                          <p>が空いています。アポの参考にしてください。</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">自宅電話</span>
            {pastDataBadge("お客様電話番号")}
            <div className="flex gap-2 items-center">
              <a href={`tel:${form.phone.replace(/\D/g, "")}`} className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline whitespace-nowrap">
                電話をかける
              </a>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass + " flex-1 min-w-0" + getRequiredErrorClass("phone")} />
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
            className={inputClass + getRequiredErrorClass("inquiryContent")}
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
            <DateInput value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} className={inputClass} />
            <CaseChat />
          </label>
          {form.status !== "parts_order" && form.status !== "estimate" && (
            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {form.status === "visit_confirmed"
                  ? "訪問確定時間"
                  : form.status === "contact_only"
                    ? "連絡のみ指定時間"
                    : form.status === "sns_sent"
                      ? "送信時間"
                      : form.status === "waiting_contact"
                        ? "連絡時間"
                        : form.status === "no_contact"
                          ? "連絡実施時間"
                          : "連絡予定時間"}
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
      {form.status === "completed" && (
        <section className="mt-6">
          <CompletionDetailForm
            ref={completionDetailFormRef}
            record={
              initialRecord
                ? ({
                    ...initialRecord,
                    status: form.status,
                    requestStoreName: form.requestStoreName,
                    requestPostalCode: form.requestPostalCode,
                    requestAddress: form.requestAddress,
                    customerName: form.customerName,
                    address: form.address,
                    modelName: form.modelName,
                    inquiryContent: form.inquiryContent,
                    internalContact: form.internalContact,
                    memo: form.memo,
                  } as CaseRecord)
                : ({
                    id: "__draft__",
                    status: "completed",
                    requestStoreName: form.requestStoreName,
                    requestPostalCode: form.requestPostalCode,
                    requestAddress: form.requestAddress,
                    customerName: form.customerName,
                    address: form.address,
                    postalCode: form.postalCode,
                    phone: form.phone,
                    modelName: form.modelName,
                    inquiryContent: form.inquiryContent,
                    internalContact: form.internalContact,
                    memo: form.memo,
                    createdAt: new Date().toISOString(),
                  } as CaseRecord)
            }
            existingDetail={initialRecord?.completionDetail}
            showSaveButton={false}
          />
        </section>
      )}
      {form.status === "estimate" && initialRecord && (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2 mb-4">
            見積内訳
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

      {lastOcrPdfFileName && (
        <p className="mt-2 text-xs text-[var(--muted)]">PDF: {lastOcrPdfFileName}</p>
      )}
      {trainingDataSaveResult && (
        <p
          className={`mt-2 text-sm ${trainingDataSaveResult.status === "success" ? "text-green-600 dark:text-green-400" : "text-[var(--alert)]"}`}
        >
          {trainingDataSaveResult.message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CasesAssistant
          open={casesAssistantOpen}
          onOpenChange={setCasesAssistantOpen}
          currentCase={{
            modelName: form.modelName,
            inquiryContent: form.inquiryContent,
            gasType: form.gasType,
          }}
        />
        <AiRepairAssistCard
          modelName={form.modelName}
          symptom={form.inquiryContent}
          status={form.status}
          instanceKey={initialRecord?.id ?? savedRecordId ?? "draft"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {showCompletionActions && form.status === "completed" && (savedRecordId ?? initialRecord?.id) && (
          <>
            <button
              type="button"
              onClick={() => {
                const id = (savedRecordId ?? initialRecord?.id) as string;
                if (id && typeof window !== "undefined") window.open(`/cases/${id}/complete/print?type=report`, "_blank", "noopener,noreferrer");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 bg-[var(--primary)] text-[var(--primary-foreground)]"
            >
              完了報告書作成
            </button>
            <button
              type="button"
              onClick={() => {
                const id = (savedRecordId ?? initialRecord?.id) as string;
                if (id && typeof window !== "undefined") window.open(`/cases/${id}/complete/print?type=estimate`, "_blank", "noopener,noreferrer");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] inline-flex items-center"
            >
              見積書作成
            </button>
            <button
              type="button"
              onClick={() => {
                const id = (savedRecordId ?? initialRecord?.id) as string;
                if (id && typeof window !== "undefined") window.open(`/cases/${id}/complete/print?type=invoice`, "_blank", "noopener,noreferrer");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] inline-flex items-center"
            >
              請求書作成
            </button>
          </>
        )}
      </div>

      {apiSaveResult && (
        <div
          className={
            apiSaveResult.status === "success"
              ? "mt-3 rounded-lg border border-green-600/50 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-200"
              : "mt-3 rounded-lg border border-[var(--alert)] bg-[var(--alert-bg)] px-4 py-3 text-sm text-[var(--alert)]"
          }
        >
          {apiSaveResult.message}
        </div>
      )}
      {showSavedToast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-green-600/40 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 shadow-lg dark:bg-green-950/40 dark:text-green-200">
          登録しました
        </div>
      )}
    </form>

    {showPastDataUpdateModal && pastDataUpdateResolve && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg max-w-md w-full p-6 space-y-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            過去データと異なります。<br />更新しますか？
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pastDataUpdateResolve("update")}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            >
              更新する
            </button>
            <button
              type="button"
              onClick={() => pastDataUpdateResolve("skip")}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              このまま登録
            </button>
          </div>
        </div>
      </div>
    )}

    {showDuplicateReceptionModal && duplicateReceptionNo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg max-w-md w-full p-6 space-y-4">
          <div className="rounded-lg border border-orange-500/80 bg-orange-500/10 p-4 text-sm text-[var(--foreground)]">
            <p className="font-medium text-orange-700 dark:text-orange-400">
              ⚠️ この受付番号（{duplicateReceptionNo}）はすでに登録されています。上書き保存しますか？
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/past-data/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      reception_no: duplicateReceptionNo,
                      shop_name: form.requestStoreName?.trim() || undefined,
                      shop_phone: form.requestPhone?.trim() || undefined,
                      shop_address: form.requestAddress?.trim() || undefined,
                      customer_name: form.customerName?.trim() || undefined,
                      customer_phone: form.phone?.trim() || undefined,
                      customer_address: form.address?.trim() || undefined,
                      overwrite: true,
                    }),
                  });
                } catch {
                  // 上書き失敗時もモーダルは閉じる
                }
                setShowDuplicateReceptionModal(false);
                setDuplicateReceptionNo(null);
              }}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              上書きして保存
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDuplicateReceptionModal(false);
                setDuplicateReceptionNo(null);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    )}

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
