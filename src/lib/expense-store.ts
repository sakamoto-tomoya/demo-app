"use client";

export const EXPENSE_CATEGORIES = [
  "交通費",
  "パーキング代",
  "宿泊費",
  "接待交際費",
  "会議費",
  "通信費",
  "消耗品費",
  "その他",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseItem {
  id: string;
  /** 日付 yyyy-MM-dd */
  date: string;
  /** 経費項目 */
  category: ExpenseCategory;
  /** 金額（円） */
  amount: number;
  /** 備考 */
  memo: string;
  /** レシート画像 Data URL */
  receiptDataUrl: string;
  /** 登録日時 */
  createdAt: string;
}

const STORAGE_KEY = "gyoumukannri_expense_items";

function load(): ExpenseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: ExpenseItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllExpenseItems(): ExpenseItem[] {
  return load();
}

export function addExpenseItem(item: Omit<ExpenseItem, "id" | "createdAt">): ExpenseItem {
  const list = load();
  const newItem: ExpenseItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newItem);
  save(list);
  return newItem;
}

export function updateExpenseItem(id: string, updates: Partial<Omit<ExpenseItem, "id" | "createdAt">>): ExpenseItem | null {
  const list = load();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...updates };
  save(list);
  return list[i];
}

export function deleteExpenseItem(id: string): boolean {
  const list = load().filter((x) => x.id !== id);
  if (list.length === load().length) return false;
  save(list);
  return true;
}
