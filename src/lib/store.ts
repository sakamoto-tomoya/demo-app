"use client";

import type { CaseRecord, CaseStatus } from "./types";
import { ALERT_DAYS_THRESHOLD, ALERT_TARGET_STATUSES } from "./types";

const STORAGE_KEY = "gyoumukannri_cases";

function loadCases(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCases(cases: CaseRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

export function getAllCases(): CaseRecord[] {
  return loadCases();
}

export function getCase(id: string): CaseRecord | null {
  return loadCases().find((c) => c.id === id) ?? null;
}

export function getCasesByStatus(status: CaseStatus): CaseRecord[] {
  return loadCases().filter((c) => c.status === status);
}

export function getCaseCounts(): Record<CaseStatus, number> {
  const cases = loadCases();
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
  for (const c of cases) {
    counts[c.status]++;
  }
  return counts;
}

export function addCase(record: Omit<CaseRecord, "id" | "createdAt">): CaseRecord {
  const cases = loadCases();
  const newRecord: CaseRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  cases.push(newRecord);
  saveCases(cases);
  return newRecord;
}

export function updateCase(id: string, updates: Partial<Omit<CaseRecord, "id" | "createdAt" | "updatedAt">>): CaseRecord | null {
  const cases = loadCases();
  const index = cases.findIndex((c) => c.id === id);
  if (index === -1) return null;
  cases[index] = { ...cases[index], ...updates, updatedAt: new Date().toISOString() };
  saveCases(cases);
  return cases[index];
}

export function deleteCase(id: string): boolean {
  const cases = loadCases().filter((c) => c.id !== id);
  if (cases.length === loadCases().length) return false;
  saveCases(cases);
  return true;
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
