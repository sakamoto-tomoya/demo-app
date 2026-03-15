/**
 * 部品伝票・返品シールの指定データ（転記先）
 * アプリ内で完結し、生成結果をここに転記して保持する
 */

import type { PartsSlipPage, ReturnLabelPage } from "./types";

const SLIP_STORAGE_KEY = "gyoumukannri_parts_slip_designated";
const LABEL_STORAGE_KEY = "gyoumukannri_return_label_designated";

export type DesignatedSlipRecord = {
  recordedAt: string; // ISO8601
  pageCount: number;
  pages: PartsSlipPage[];
};

export type DesignatedLabelRecord = {
  recordedAt: string;
  pageCount: number;
  totalItems: number;
  pages: ReturnLabelPage[];
};

function loadJson<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** 部品伝票を指定データに転記する */
export function recordPartsSlip(pages: PartsSlipPage[]): void {
  const record: DesignatedSlipRecord = {
    recordedAt: new Date().toISOString(),
    pageCount: pages.length,
    pages,
  };
  saveJson(SLIP_STORAGE_KEY, record);
}

/** 返品シールを指定データに転記する */
export function recordReturnLabel(pages: ReturnLabelPage[]): void {
  const totalItems = pages.reduce((s, p) => s + p.items.length, 0);
  const record: DesignatedLabelRecord = {
    recordedAt: new Date().toISOString(),
    pageCount: pages.length,
    totalItems,
    pages,
  };
  saveJson(LABEL_STORAGE_KEY, record);
}

/** 転記済みの部品伝票を取得 */
export function getDesignatedSlip(): DesignatedSlipRecord | null {
  const v = loadJson<DesignatedSlipRecord | null>(SLIP_STORAGE_KEY, null);
  return v && Array.isArray(v.pages) && v.pages.length > 0 ? v : null;
}

/** 転記済みの返品シールを取得 */
export function getDesignatedLabel(): DesignatedLabelRecord | null {
  const v = loadJson<DesignatedLabelRecord | null>(LABEL_STORAGE_KEY, null);
  return v && Array.isArray(v.pages) ? v : null;
}

/** 指定データ（部品伝票）をクリア */
export function clearDesignatedSlip(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SLIP_STORAGE_KEY);
}

/** 指定データ（返品シール）をクリア */
export function clearDesignatedLabel(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LABEL_STORAGE_KEY);
}

/** 指定データをすべてクリア */
export function clearAllDesignated(): void {
  clearDesignatedSlip();
  clearDesignatedLabel();
}
