"use client";

import type { CaseRecord, CaseStatus } from "./types";
import { ALERT_DAYS_THRESHOLD, ALERT_TARGET_STATUSES } from "./types";

async function fetchCases(): Promise<CaseRecord[]> {
  const res = await fetch("/api/cases", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; cases?: CaseRecord[] };
  return data.ok && Array.isArray(data.cases) ? data.cases : [];
}

export async function getAllCases(): Promise<CaseRecord[]> {
  return fetchCases();
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const res = await fetch(`/api/cases?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; case?: CaseRecord | null };
  return data.ok ? (data.case ?? null) : null;
}

export async function getCasesByStatus(status: CaseStatus): Promise<CaseRecord[]> {
  const cases = await fetchCases();
  return cases.filter((c) => c.status === status);
}

export async function getCaseCounts(): Promise<Record<CaseStatus, number>> {
  const cases = await fetchCases();
  const counts = {
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
  } as Record<CaseStatus, number>;
  for (const c of cases) counts[c.status]++;
  return counts;
}

export async function addCase(record: Omit<CaseRecord, "id" | "createdAt">): Promise<CaseRecord | null> {
  const now = new Date().toISOString();
  const draft: CaseRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const res = await fetch("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record: draft }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; case?: CaseRecord };
  return data.ok ? (data.case ?? null) : null;
}

export async function updateCase(
  id: string,
  updates: Partial<Omit<CaseRecord, "id" | "createdAt" | "updatedAt">>
): Promise<CaseRecord | null> {
  const res = await fetch("/api/cases", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updates }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; case?: CaseRecord };
  return data.ok ? (data.case ?? null) : null;
}

export async function deleteCase(id: string): Promise<boolean> {
  const res = await fetch(`/api/cases?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return false;
  const data = (await res.json()) as { ok?: boolean };
  return !!data.ok;
}

/** 登録日から指定日数以上経過しているか */
export function isOverAlertThreshold(createdAt: string, days: number = ALERT_DAYS_THRESHOLD): boolean {
  const created = new Date(createdAt);
  const limit = new Date(created);
  limit.setDate(limit.getDate() + days);
  return new Date() >= limit;
}

/** アラート対象か（訪問日決定以外 & 登録から5日以上） */
export function shouldAlert(record: CaseRecord): boolean {
  if (!ALERT_TARGET_STATUSES.includes(record.status)) return false;
  return isOverAlertThreshold(record.createdAt);
}

/** ルート登録でピン止めした地点 */
export interface RoutePin {
  id: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
  addedAt: string;
}

const ROUTE_PINS_KEY = "gyoumukannri_route_pins";

function loadRoutePins(): RoutePin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTE_PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoutePin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRoutePins(pins: RoutePin[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROUTE_PINS_KEY, JSON.stringify(pins));
}

export function getRoutePins(): RoutePin[] {
  return loadRoutePins();
}

export function addRoutePin(pin: Omit<RoutePin, "id" | "addedAt">): RoutePin {
  const pins = loadRoutePins();
  const newPin: RoutePin = {
    ...pin,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };
  pins.push(newPin);
  saveRoutePins(pins);
  return newPin;
}

export function removeRoutePin(id: string): boolean {
  const pins = loadRoutePins().filter((p) => p.id !== id);
  if (pins.length === loadRoutePins().length) return false;
  saveRoutePins(pins);
  return true;
}
