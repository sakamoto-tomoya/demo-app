"use client";

import type { InboundRecord, OutboundRecord, VehiclePartRecord, PartsMasterRecord, ProductPartsKnowledgeRecord } from "./parts-types";
export type { InboundRecord, OutboundRecord, VehiclePartRecord, PartsMasterRecord, ProductPartsKnowledgeRecord };

const INBOUND_KEY = "gyoumukannri_parts_inbound";
const OUTBOUND_KEY = "gyoumukannri_parts_outbound";
const VEHICLE_PARTS_KEY = "gyoumukannri_parts_vehicle";
const PARTS_MASTER_KEY = "gyoumukannri_parts_master";
const PRODUCT_PARTS_KNOWLEDGE_KEY = "gyoumukannri_product_parts_knowledge";

/** 同一タブ内の画面でも在庫表示を更新できるよう通知（localStorage の storage イベントは同一タブでは発火しない） */
function notifyPartsStorageChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gyoumukannri-parts-storage"));
}

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
  notifyPartsStorageChanged();
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
  notifyPartsStorageChanged();
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
  notifyPartsStorageChanged();
}

/** 部品品番の比較用：前後空白除去・全角数字を半角に統一・ハイフン類を除去（入庫と出庫の表記揺れで集計が分かれないようにする） */
export function normalizePartNo(partNo: string): string {
  let t = (partNo ?? "").trim();
  t = t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  t = t.replace(/[\u002D\u00AD\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "");
  return t;
}

/** 日本語（CJK）の文字数を数える */
function countCjk(s: string): number {
  const cjk = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/g;
  const m = s.match(cjk);
  return m ? m.length : 0;
}

/** 文字化けした文字列を修復（UTF-8として読まれたShift_JISバイト列を正しく解釈し直す） */
function tryFixMojibake(s: string): string {
  if (!s || typeof s !== "string") return s;
  // よくある「繝ｸ繝ｳ…」「霆ｸ」「譁ｭ…」などのパターンを含む場合のみ変換を試す
  // （正しい日本語を無駄に変換してしまうのを避ける）
  const looksMojibake = /[繝譁霆ｸｳｳ繧繝]/.test(s);
  if (!looksMojibake) return s;
  try {
    const utf8Bytes = new TextEncoder().encode(s);

    // 変換1: UTF-8としてエンコードしたバイト列を Shift_JIS として復元
    const cand1 = new TextDecoder("shift_jis").decode(utf8Bytes);

    // 変換2: 文字コードの下位8bitをバイト列として扱い、UTF-8 として復元
    const bytesFromChars = new Uint8Array(
      Array.from(s).map((ch) => ch.charCodeAt(0) & 0xff)
    );
    const cand2 = new TextDecoder("utf-8").decode(bytesFromChars);

    const valid1 = !cand1.includes("\uFFFD");
    const valid2 = !cand2.includes("\uFFFD");
    const c0 = countCjk(s);
    const c1 = countCjk(cand1);
    const c2 = countCjk(cand2);

    // 文字化け特有の「繝」や「霆」などが減り、日本語(CJK)が増える方を採用
    const bad0 = (s.match(/[繝譁霆ｸｳｳ繧繝]/g) ?? []).length;
    const bad1 = (cand1.match(/[繝譁霆ｸｳｳ繧繝]/g) ?? []).length;
    const bad2 = (cand2.match(/[繝譁霆ｸｳｳ繧繝]/g) ?? []).length;

    const score = (cCand: number, badCand: number): number => {
      return (cCand - c0) * 10 + (bad0 - badCand);
    };

    let best = s;
    let bestScore = 0;

    if (valid1) {
      const sc1 = score(c1, bad1);
      if (sc1 > bestScore) {
        bestScore = sc1;
        best = cand1;
      }
    }
    if (valid2) {
      const sc2 = score(c2, bad2);
      if (sc2 > bestScore) {
        bestScore = sc2;
        best = cand2;
      }
    }

    return best;
  } catch {
    // shift_jis が未対応または不正な並びの場合はそのまま
  }
  return s;
}

// --- 部品マスタ ---
function loadPartsMaster(): PartsMasterRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PARTS_MASTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PartsMasterRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePartsMaster(list: PartsMasterRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARTS_MASTER_KEY, JSON.stringify(list));
}

export function getAllPartsMaster(): PartsMasterRecord[] {
  const list = loadPartsMaster();
  // 画面描画直前: 直近の1件を確認できるようにする（モジバケ切り分け用）
  try {
    const first = list[0];
    console.log("[parts-store] getAllPartsMaster: first.raw=", first?.partName ?? "", "len=", (first?.partName ?? "").length);
  } catch {
    // ignore
  }
  return list.map((r) => ({
    ...r,
    partNo: tryFixMojibake(r.partNo ?? ""),
    partName: tryFixMojibake(r.partName ?? ""),
  }));
}

/** 保存されている部品マスタの文字化けを修復して上書き保存する。1回だけ実行すればよい。 */
export function migratePartsMasterMojibake(): number {
  const list = loadPartsMaster();
  let changed = 0;
  const fixed = list.map((r) => {
    const partNo = tryFixMojibake(r.partNo ?? "");
    const partName = tryFixMojibake(r.partName ?? "");
    if (partNo !== (r.partNo ?? "") || partName !== (r.partName ?? "")) changed++;
    return { ...r, partNo, partName };
  });
  if (changed > 0) savePartsMaster(fixed);
  return changed;
}

/** 単価の有効範囲：0円～10万円（0は「¥0」表示のため有効） */
const MIN_VALID_PART_COST = 0;
const MAX_VALID_PART_COST = 100_000;

/** 不正な単価（0円未満または10万円超）をクリアして上書き保存する。1回だけ実行すればよい。 */
export function migratePartsMasterPartCost(): number {
  const list = loadPartsMaster();
  let changed = 0;
  const fixed = list.map((r) => {
    if (r.partCost != null && (r.partCost < MIN_VALID_PART_COST || r.partCost > MAX_VALID_PART_COST)) {
      changed++;
      return { ...r, partCost: undefined as number | undefined };
    }
    return r;
  });
  if (changed > 0) savePartsMaster(fixed);
  return changed;
}

export function findPartsMasterByPartNo(partNo: string): PartsMasterRecord | null {
  const key = normalizePartNo(partNo ?? "");
  if (!key) return null;
  return getAllPartsMaster().find((r) => normalizePartNo(r.partNo ?? "") === key) ?? null;
}

export function addPartsMaster(record: Omit<PartsMasterRecord, "id" | "createdAt">): PartsMasterRecord {
  const list = loadPartsMaster();
  const newRecord: PartsMasterRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  savePartsMaster(list);
  return newRecord;
}

export function deletePartsMaster(id: string): boolean {
  const list = loadPartsMaster().filter((r) => r.id !== id);
  if (list.length === loadPartsMaster().length) return false;
  savePartsMaster(list);
  return true;
}

/** 部品マスタの登録一覧をすべて削除する */
export function clearAllPartsMaster(): void {
  savePartsMaster([]);
}

/** 部品マスタの「部品品番」と「部品名称」を全件入れ替える。列取り込み間違いの修正用。戻り値は入れ替えた件数。 */
export function swapPartsMasterPartNoAndPartName(): number {
  const list = loadPartsMaster();
  let count = 0;
  const fixed = list.map((r) => {
    const no = r.partNo ?? "";
    const name = r.partName ?? "";
    if (!no || !name || no === name) return r;
    count++;
    return { ...r, partNo: name, partName: no };
  });
  if (count > 0) savePartsMaster(fixed);
  return count;
}

/** 入庫登録時に部品マスタの単価を反映する。既存なら単価（と部品名）を更新、なければ追加。 */
export function syncPartsMasterFromInbound(partNo: string, partName: string, partCost: number | undefined): void {
  const list = loadPartsMaster();
  const key = normalizePartNo(partNo ?? "");
  if (!key) return;
  const existingIndex = list.findIndex((r) => normalizePartNo(r.partNo ?? "") === key);
  const name = (partName ?? "").trim() || partNo;
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], partNo: list[existingIndex].partNo, partName: name, partCost: partCost ?? list[existingIndex].partCost, createdAt: list[existingIndex].createdAt };
  } else {
    list.push({
      id: crypto.randomUUID(),
      partNo,
      partName: name,
      partCost,
      createdAt: new Date().toISOString(),
    });
  }
  savePartsMaster(list);
}

/** 部品マスタを一括登録。品番が既存なら上書き（部品名・ガス種・単価を更新）。戻り値は登録・更新した件数。 */
export function importPartsMasterFromRows(
  rows: { partNo: string; partName: string; gasType?: string; partCost?: number }[]
): { added: number; updated: number } {
  // CSV読込直後: rows の先頭1件を確認
  try {
    const first = rows[0];
    console.log("[parts-store] importPartsMasterFromRows: first.row=", first);
    console.log("[parts-store] importPartsMasterFromRows: first.partName(raw)=", first?.partName ?? "");
  } catch {
    // ignore
  }
  const list = loadPartsMaster();
  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const partNo = (row.partNo ?? "").trim();
    if (!partNo) continue;
    const key = normalizePartNo(partNo);
    // 保存時点でも文字化けを直しておく（表示だけ直しても入力欄等で未修復の値が出るケースを防ぐ）
    const rawPartName = (row.partName ?? "").trim();
    const fixedPartName = tryFixMojibake(rawPartName || partNo);
    const gasType = (row.gasType ?? "").trim() || undefined;
    const partCost = row.partCost != null ? Number(row.partCost) : undefined;
    const existingIndex = list.findIndex((r) => normalizePartNo(r.partNo ?? "") === key);
    if (existingIndex >= 0) {
      // DB保存前: 変更される対象の1件を確認（大量に出るのを避けて最初の更新だけ）
      if (updated === 0) {
        console.log("[parts-store] importPartsMasterFromRows: beforeUpdate existing=", list[existingIndex], "new.partName.fixed=", fixedPartName);
      }
      list[existingIndex] = { ...list[existingIndex], partNo, partName: fixedPartName, gasType, partCost, createdAt: list[existingIndex].createdAt };
      updated++;
    } else {
      list.push({
        id: crypto.randomUUID(),
        partNo,
        partName: fixedPartName,
        gasType,
        partCost,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
  }

  // DB保存後: 保存した後に再取得して先頭1件を確認
  try {
    savePartsMaster(list);
    const reloaded = loadPartsMaster();
    console.log("[parts-store] importPartsMasterFromRows: afterSave first.reloaded.partName=", reloaded[0]?.partName ?? "");
    return {
      added,
      updated,
    };
  } catch (e) {
    // ここに来たら savePartsMaster 前後で例外が出ているので、そのまま落ちるようにする
    throw e;
  }
}

// --- 製品型番・製品品番 → 部品品番（ナレッジ）---
function loadProductPartsKnowledge(): ProductPartsKnowledgeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRODUCT_PARTS_KNOWLEDGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductPartsKnowledgeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProductPartsKnowledge(list: ProductPartsKnowledgeRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRODUCT_PARTS_KNOWLEDGE_KEY, JSON.stringify(list));
}

export function getAllProductPartsKnowledge(): ProductPartsKnowledgeRecord[] {
  return loadProductPartsKnowledge();
}

export function getProductPartsKnowledgeByProductCode(productCode: string): ProductPartsKnowledgeRecord | null {
  const key = normalizePartNo(productCode ?? "");
  if (!key) return null;
  return loadProductPartsKnowledge().find((r) => normalizePartNo(r.productCode ?? "") === key) ?? null;
}

export function getPartNosByProductCode(productCode: string): string[] {
  const rec = getProductPartsKnowledgeByProductCode(productCode);
  return rec?.partNos ?? [];
}

export function addOrUpdateProductPartsKnowledge(
  productCode: string,
  productName: string | undefined,
  partNos: string[]
): ProductPartsKnowledgeRecord {
  const list = loadProductPartsKnowledge();
  const code = (productCode ?? "").trim();
  const key = normalizePartNo(code);
  const partNosTrimmed = partNos.map((p) => (p ?? "").trim()).filter(Boolean);
  const existingIndex = key ? list.findIndex((r) => normalizePartNo(r.productCode ?? "") === key) : -1;
  const record: ProductPartsKnowledgeRecord = {
    id: existingIndex >= 0 ? list[existingIndex].id : crypto.randomUUID(),
    productCode: code,
    productName: (productName ?? "").trim() || undefined,
    partNos: partNosTrimmed,
    createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    list[existingIndex] = record;
  } else {
    list.push(record);
  }
  saveProductPartsKnowledge(list);
  return record;
}

export function deleteProductPartsKnowledge(id: string): boolean {
  const list = loadProductPartsKnowledge().filter((r) => r.id !== id);
  if (list.length === loadProductPartsKnowledge().length) return false;
  saveProductPartsKnowledge(list);
  return true;
}

/** Difyナレッジ用テキストに整形。製品型番・製品品番ごとに部品品番一覧を列挙。 */
export function formatProductPartsKnowledgeForDify(records: ProductPartsKnowledgeRecord[]): string {
  const lines: string[] = ["【製品型番・製品品番と部品品番の対応】", ""];
  for (const r of records.sort((a, b) => (a.productCode ?? "").localeCompare(b.productCode ?? ""))) {
    const name = r.productName ? `（${r.productName}）` : "";
    lines.push(`製品型番・品番: ${r.productCode}${name}`);
    lines.push(`部品品番: ${(r.partNos ?? []).join(", ") || "—"}`);
    lines.push("");
  }
  return lines.join("\n").trim();
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

/** AI修理アシスト：型式に紐づく部品の在庫行（製品型番ナレッジ → 部品マスタのキーワード補完） */
export type RelatedPartStockRow = {
  partNo: string;
  partName: string;
  warehouseRemaining: number;
  vehicleQty: number;
  source: "product_knowledge" | "name_match";
};

const MAX_NAME_MATCH_ROWS = 25;

function modelMatchesProductKnowledge(model: string, productCode: string, productName: string): boolean {
  const m = model.trim().toLowerCase();
  const c = (productCode ?? "").trim().toLowerCase();
  const n = (productName ?? "").trim().toLowerCase();
  if (!m) return false;
  if (c && (m.includes(c) || c.includes(m))) return true;
  if (n && (m.includes(n) || n.includes(m))) return true;
  return false;
}

/**
 * 型式名から関連する部品品番を推定し、入庫−出庫の残（オーダー別合算）と車載数量を返す。
 * ブラウザの部品管理（localStorage）のみ参照する。
 */
export function getRelatedPartsStockForModel(modelName: string): RelatedPartStockRow[] {
  const q = (modelName ?? "").trim();
  if (!q) return [];

  const seen = new Set<string>();
  const rows: RelatedPartStockRow[] = [];

  const pushRow = (partNoRaw: string, source: RelatedPartStockRow["source"]) => {
    const key = normalizePartNo(partNoRaw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const master = findPartsMasterByPartNo(partNoRaw);
    const inbound = getInboundByPartNo(partNoRaw)[0];
    const partName = master?.partName?.trim() || inbound?.partName?.trim() || key;
    const remainings = getRemainingQtyByOrderNo(partNoRaw);
    const warehouseRemaining = remainings.reduce((s, x) => s + x.remaining, 0);
    const vehicleQty = getVehiclePartQuantityByPartNo(partNoRaw);
    rows.push({ partNo: key, partName, warehouseRemaining, vehicleQty, source });
  };

  for (const rec of getAllProductPartsKnowledge()) {
    if (!modelMatchesProductKnowledge(q, rec.productCode ?? "", rec.productName ?? "")) continue;
    for (const p of rec.partNos ?? []) {
      if ((p ?? "").trim()) pushRow(p.trim(), "product_knowledge");
    }
  }

  const qLower = q.toLowerCase();
  let nameMatches = 0;
  for (const m of getAllPartsMaster()) {
    if (nameMatches >= MAX_NAME_MATCH_ROWS) break;
    const key = normalizePartNo(m.partNo);
    if (!key || seen.has(key)) continue;
    const name = (m.partName ?? "").toLowerCase();
    if (name.includes(qLower) || key.toLowerCase().includes(qLower)) {
      pushRow(m.partNo, "name_match");
      nameMatches += 1;
    }
  }

  return rows.sort((a, b) => {
    const pri = (s: RelatedPartStockRow["source"]) => (s === "product_knowledge" ? 0 : 1);
    const d = pri(a.source) - pri(b.source);
    if (d !== 0) return d;
    return a.partNo.localeCompare(b.partNo);
  });
}
