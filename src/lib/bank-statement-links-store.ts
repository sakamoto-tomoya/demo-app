"use client";

/** 銀行入出金明細へのリンク1件 */
export interface BankStatementLinkRecord {
  id: string;
  /** 銀行名（表示用） */
  bankName: string;
  /** 入出金明細ページのURL */
  url: string;
  /** 登録日時 */
  createdAt: string;
}

const STORAGE_KEY = "gyoumukannri_bank_statement_links";

function load(): BankStatementLinkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BankStatementLinkRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: BankStatementLinkRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllBankStatementLinks(): BankStatementLinkRecord[] {
  return load();
}

export function addBankStatementLink(record: Omit<BankStatementLinkRecord, "id" | "createdAt">): BankStatementLinkRecord {
  const list = load();
  const newRecord: BankStatementLinkRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  save(list);
  return newRecord;
}

export function deleteBankStatementLink(id: string): boolean {
  const list = load().filter((r) => r.id !== id);
  if (list.length === load().length) return false;
  save(list);
  return true;
}
