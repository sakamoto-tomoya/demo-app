"use client";

import type { InboundRecord, OutboundRecord, VehiclePartRecord } from "./parts-types";
export type { InboundRecord, OutboundRecord, VehiclePartRecord };

const INBOUND_KEY = "gyoumukannri_parts_inbound";
const OUTBOUND_KEY = "gyoumukannri_parts_outbound";
const VEHICLE_PARTS_KEY = "gyoumukannri_parts_vehicle";

function loadInbound(): InboundRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INBOUND_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboundRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInbound(list: InboundRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INBOUND_KEY, JSON.stringify(list));
}

function loadOutbound(): OutboundRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OUTBOUND_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboundRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOutbound(list: OutboundRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OUTBOUND_KEY, JSON.stringify(list));
}

function loadVehicleParts(): VehiclePartRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VEHICLE_PARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VehiclePartRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVehicleParts(list: VehiclePartRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VEHICLE_PARTS_KEY, JSON.stringify(list));
}

/** 部品品番の比較用：前後空白除去・全角数字を半角に統一 */
export function normalizePartNo(partNo: string): string {
  const t = (partNo ?? "").trim();
  return t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// --- 入庫 ---
export function getAllInbound(): InboundRecord[] {
  return loadInbound();
}

export function addInbound(record: Omit<InboundRecord, "id" | "createdAt">): InboundRecord {
  const list = loadInbound();
  const newRecord: InboundRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  try {
    saveInbound(list);
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      const withoutImages: InboundRecord = { ...newRecord, cameraImageDataUrl: undefined, photoImageDataUrl: undefined };
      list[list.length - 1] = withoutImages;
      saveInbound(list);
    } else {
      throw e;
    }
  }
  return newRecord;
}

export function updateInbound(id: string, updates: Partial<Omit<InboundRecord, "id" | "createdAt">>): InboundRecord | null {
  const list = loadInbound();
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...updates };
  saveInbound(list);
  return list[i];
}

export function deleteInbound(id: string): boolean {
  const list = loadInbound().filter((r) => r.id !== id);
  if (list.length === loadInbound().length) return false;
  saveInbound(list);
  return true;
}

// --- 出庫 ---
export function getAllOutbound(): OutboundRecord[] {
  return loadOutbound();
}

/** 部品品番で入庫履歴を取得（日付の新しい順） */
export function getInboundByPartNo(partNo: string): InboundRecord[] {
  const key = normalizePartNo(partNo);
  if (!key) return [];
  return loadInbound()
    .filter((r) => normalizePartNo(r.partNo ?? "") === key)
    .sort((a, b) => (b.inboundDate || "").localeCompare(a.inboundDate || ""));
}

/** 部品品番で出庫履歴を取得（日付の新しい順） */
export function getOutboundByPartNo(partNo: string): OutboundRecord[] {
  const key = normalizePartNo(partNo);
  if (!key) return [];
  return loadOutbound()
    .filter((r) => normalizePartNo(r.partNo ?? "") === key)
    .sort((a, b) => (b.outboundDate || "").localeCompare(a.outboundDate || ""));
}

/**
 * 部品品番ごとに、オーダー番号別の残り可能出庫数（入庫数−出庫数）を返す。
 * FIFO用に古い入庫のオーダーから並べる。残り0のオーダーは含めない。
 */
export function getRemainingQtyByOrderNo(partNo: string): { orderNo: string; remaining: number }[] {
  const key = normalizePartNo(partNo);
  if (!key) return [];
  const inbounds = loadInbound().filter((r) => normalizePartNo(r.partNo ?? "") === key);
  const outbounds = loadOutbound().filter((r) => normalizePartNo(r.partNo ?? "") === key);
  const byOrder: Record<string, { inbound: number; outbound: number; earliestDate: string }> = {};
  for (const i of inbounds) {
    const o = i.orderNo ?? "";
    if (!byOrder[o]) byOrder[o] = { inbound: 0, outbound: 0, earliestDate: i.inboundDate ?? "" };
    byOrder[o].inbound += i.inboundQty ?? 0;
    const d = i.inboundDate ?? "";
    if (d && (!byOrder[o].earliestDate || d < byOrder[o].earliestDate)) byOrder[o].earliestDate = d;
  }
  for (const o of outbounds) {
    const ord = o.orderNo ?? "";
    if (ord in byOrder) byOrder[ord].outbound += o.outboundQty ?? 0;
  }
  return Object.entries(byOrder)
    .map(([orderNo, v]) => ({
      orderNo,
      remaining: Math.max(0, v.inbound - v.outbound),
      earliestDate: v.earliestDate,
    }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => (a.earliestDate || "").localeCompare(b.earliestDate || ""))
    .map(({ orderNo, remaining }) => ({ orderNo, remaining }));
}

/** オーダー番号の比較用（前後空白除去・全角数字を半角に） */
function normalizeOrderNo(orderNo: string): string {
  const t = (orderNo ?? "").trim();
  return t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 指定オーダー番号の残り数（入庫数−出庫数）を返す。0未満になり得る（入庫を超えて出庫した場合）。
 * オーダーが入庫に存在しない場合は null。出庫のみ存在する場合は 0 - 出庫数（負）を返す。
 */
export function getOrderRemainingRaw(partNo: string, orderNo: string): number | null {
  const orderNorm = normalizeOrderNo(orderNo);
  if (!orderNorm) return null;
  const key = normalizePartNo(partNo);
  if (!key) return null;
  const inbounds = loadInbound().filter((r) => normalizePartNo(r.partNo ?? "") === key);
  const outbounds = loadOutbound().filter((r) => normalizePartNo(r.partNo ?? "") === key);
  let inbound = 0;
  for (const i of inbounds) {
    if (normalizeOrderNo(i.orderNo ?? "") === orderNorm) inbound += i.inboundQty ?? 0;
  }
  let outbound = 0;
  for (const o of outbounds) {
    if (normalizeOrderNo(o.orderNo ?? "") === orderNorm) outbound += o.outboundQty ?? 0;
  }
  const remaining = inbound - outbound;
  if (inbound === 0 && outbound === 0) return null;
  return remaining;
}

/** 指定オーダー番号の入庫登録数（入庫数の合計）を返す。入庫に存在しない場合は 0。 */
export function getOrderInboundQty(partNo: string, orderNo: string): number {
  const orderNorm = normalizeOrderNo(orderNo);
  if (!orderNorm) return 0;
  const key = normalizePartNo(partNo);
  if (!key) return 0;
  const inbounds = loadInbound().filter((r) => normalizePartNo(r.partNo ?? "") === key);
  let qty = 0;
  for (const i of inbounds) {
    if (normalizeOrderNo(i.orderNo ?? "") === orderNorm) qty += i.inboundQty ?? 0;
  }
  return qty;
}

export function addOutbound(record: Omit<OutboundRecord, "id" | "createdAt">): OutboundRecord {
  const list = loadOutbound();
  const newRecord: OutboundRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  saveOutbound(list);
  return newRecord;
}

export function updateOutbound(id: string, updates: Partial<Omit<OutboundRecord, "id" | "createdAt">>): OutboundRecord | null {
  const list = loadOutbound();
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...updates };
  saveOutbound(list);
  return list[i];
}

export function deleteOutbound(id: string): boolean {
  const list = loadOutbound().filter((r) => r.id !== id);
  if (list.length === loadOutbound().length) return false;
  saveOutbound(list);
  return true;
}

/** 出庫履歴をすべて削除する */
export function clearAllOutbound(): void {
  saveOutbound([]);
}

// --- 車載部品（在庫・棚卸） ---
export function getAllVehicleParts(): VehiclePartRecord[] {
  return loadVehicleParts();
}

/**
 * 部品品番を normalizePartNo で集約し、同一品番の数量を合算した一覧を返す（在庫検索・棚卸の表示用）
 */
export function getVehiclePartsMergedByPartNo(): VehiclePartRecord[] {
  const list = loadVehicleParts();
  const byKey = new Map<string, VehiclePartRecord>();
  for (const r of list) {
    const key = normalizePartNo(r.partNo ?? "");
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        quantity: (existing.quantity ?? 0) + (r.quantity ?? 0),
        updatedAt: r.updatedAt ?? existing.updatedAt,
      });
    } else {
      byKey.set(key, { ...r });
    }
  }
  return Array.from(byKey.values());
}

export function getVehiclePart(id: string): VehiclePartRecord | null {
  return loadVehicleParts().find((r) => r.id === id) ?? null;
}

export function searchVehicleParts(query: string): VehiclePartRecord[] {
  const list = loadVehicleParts();
  if (!query.trim()) return list;
  const q = query.trim().toLowerCase();
  return list.filter(
    (r) =>
      r.partNo.toLowerCase().includes(q) ||
      r.partName.toLowerCase().includes(q) ||
      r.storagePlaceVehicle.toLowerCase().includes(q)
  );
}

export function addVehiclePart(record: Omit<VehiclePartRecord, "id" | "createdAt">): VehiclePartRecord {
  const list = loadVehicleParts();
  const newRecord: VehiclePartRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  saveVehicleParts(list);
  return newRecord;
}

/** 部品品番に一致する全車載部品レコードを取得（マージせず・保管場所別に複数あり得る） */
export function getVehiclePartsByPartNo(partNo: string): VehiclePartRecord[] {
  const key = normalizePartNo(partNo);
  if (!key) return [];
  return loadVehicleParts().filter((r) => normalizePartNo(r.partNo ?? "") === key);
}

/** 部品品番で車載部品を検索（完全一致・前後空白無視・全角半角統一） */
export function findVehiclePartByPartNo(partNo: string): VehiclePartRecord | null {
  const n = normalizePartNo(partNo);
  if (!n) return null;
  return loadVehicleParts().find((r) => normalizePartNo(r.partNo ?? "") === n) ?? null;
}

/** 部品品番ごとの合算数量を返す（同一品番が複数レコードでも合計。出庫の自動転記用） */
export function getVehiclePartQuantityByPartNo(partNo: string): number {
  const key = normalizePartNo(partNo);
  if (!key) return 0;
  return loadVehicleParts()
    .filter((r) => normalizePartNo(r.partNo ?? "") === key)
    .reduce((sum, r) => sum + (r.quantity ?? 0), 0);
}

/**
 * 車載部品に数量を加算する。同じ部品品番が既にあればその数量に加算、なければ新規追加。
 * 部品品番は normalizePartNo で照合するため、全角・半角や前後空白が違っても同一とみなす。
 */
export function addOrIncrementVehiclePart(
  record: Omit<VehiclePartRecord, "id" | "createdAt">
): VehiclePartRecord {
  const list = loadVehicleParts();
  const key = normalizePartNo(record.partNo ?? "");
  if (!key) return addVehiclePart(record);
  const existing = list.find((r) => normalizePartNo(r.partNo ?? "") === key);
  if (existing) {
    const newQty = (existing.quantity ?? 0) + (Number(record.quantity) || 0);
    const updated = { ...existing, quantity: newQty, updatedAt: new Date().toISOString() };
    list[list.findIndex((r) => r.id === existing.id)] = updated;
    saveVehicleParts(list);
    return updated;
  }
  return addVehiclePart(record);
}

/**
 * 同一部品品番の車載部品レコードを1件に集約し、数量を合算する（全角半角・空白は normalizePartNo で同一判定）
 */
function mergeVehiclePartsByNormalizedPartNo(partNo: string): void {
  const key = normalizePartNo(partNo);
  if (!key) return;
  const list = loadVehicleParts();
  const indices = list
    .map((r, i) => (normalizePartNo(r.partNo ?? "") === key ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length <= 1) return;
  const firstIdx = indices[0]!;
  const totalQty = indices.reduce((sum, i) => sum + (list[i]!.quantity ?? 0), 0);
  const merged = { ...list[firstIdx]!, quantity: totalQty, updatedAt: new Date().toISOString() };
  list[firstIdx] = merged;
  const toRemove = indices.slice(1).sort((a, b) => b - a);
  toRemove.forEach((i) => list.splice(i, 1));
  saveVehicleParts(list);
}

/** 出庫登録時：同じ部品品番の車載部品の数量から減算する（0未満にはしない）。同一品番が複数レコードの場合は先に合算してから減算。 */
export function decrementVehiclePartByPartNo(partNo: string, outboundQty: number): void {
  if (outboundQty <= 0) return;
  mergeVehiclePartsByNormalizedPartNo(partNo);
  const existing = findVehiclePartByPartNo(partNo);
  if (!existing) return;
  const newQty = Math.max(0, (existing.quantity ?? 0) - outboundQty);
  updateVehiclePart(existing.id, { quantity: newQty });
}

/** 棚卸で部品品番ごとの数量を一括設定する。同一品番が複数レコードの場合は先に合算してから1件に上書き。 */
export function setVehiclePartQuantityByPartNo(partNo: string, quantity: number): void {
  const qty = Math.max(0, Number(quantity) || 0);
  mergeVehiclePartsByNormalizedPartNo(partNo);
  const existing = findVehiclePartByPartNo(partNo);
  if (existing) updateVehiclePart(existing.id, { quantity: qty });
}

export function updateVehiclePart(
  id: string,
  updates: Partial<Omit<VehiclePartRecord, "id" | "createdAt">>
): VehiclePartRecord | null {
  const list = loadVehicleParts();
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const updated = { ...list[i], ...updates, updatedAt: new Date().toISOString() };
  list[i] = updated;
  saveVehicleParts(list);
  return list[i];
}

export function deleteVehiclePart(id: string): boolean {
  const list = loadVehicleParts().filter((r) => r.id !== id);
  if (list.length === loadVehicleParts().length) return false;
  saveVehicleParts(list);
  return true;
}

/** 部品品番で車載部品を検索し、同一品番のレコードをすべて削除する（normalizePartNo で照合） */
export function deleteVehiclePartByPartNo(partNo: string): boolean {
  const key = normalizePartNo(partNo);
  if (!key) return false;
  const list = loadVehicleParts().filter((r) => normalizePartNo(r.partNo ?? "") !== key);
  if (list.length === loadVehicleParts().length) return false;
  saveVehicleParts(list);
  return true;
}
