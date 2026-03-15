"use client";

/** 銀行入金データ1件（請求書と照合するための項目） */
export interface BankPaymentRecord {
  id: string;
  /** 請求書作成日 yyyy-MM-dd */
  invoiceDate: string;
  /** 受付番号（請求書No） */
  receptionNo: string;
  /** 御社指定No */
  specifiedNo: string;
  /** 請求先宛名 */
  recipientName: string;
  /** 郵便番号 */
  postalCode: string;
  /** ご請求金額（税込）数値または文字列 */
  amount: string;
  /** 登録日時（一覧表示用） */
  createdAt: string;
}

const STORAGE_KEY = "gyoumukannri_bank_payments";

function load(): BankPaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BankPaymentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: BankPaymentRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllBankPayments(): BankPaymentRecord[] {
  return load();
}

export function addBankPayment(
  record: Omit<BankPaymentRecord, "id" | "createdAt">
): BankPaymentRecord {
  const list = load();
  const newRecord: BankPaymentRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.push(newRecord);
  save(list);
  return newRecord;
}

export function deleteBankPayment(id: string): boolean {
  const list = load().filter((r) => r.id !== id);
  if (list.length === load().length) return false;
  save(list);
  return true;
}

/** 複数件を一括追加。CSV形式: 1行1件、請求書作成日,受付番号,御社指定No,請求先宛名,郵便番号,金額 */
export function addBankPaymentsFromCsv(csvText: string): { added: number; errors: string[] } {
  const lines = csvText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const errors: string[] = [];
  let added = 0;
  const list = load();
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 6) {
      errors.push(`${i + 1}行目: 列が不足しています（6列必要）`);
      continue;
    }
    const [invoiceDate, receptionNo, specifiedNo, recipientName, postalCode, amount] = cols;
    if (!invoiceDate || !receptionNo || !specifiedNo || !recipientName || !postalCode || amount === undefined || amount === "") {
      errors.push(`${i + 1}行目: 必須項目が空です`);
      continue;
    }
    list.push({
      id: crypto.randomUUID(),
      invoiceDate,
      receptionNo,
      specifiedNo,
      recipientName,
      postalCode,
      amount,
      createdAt: new Date().toISOString(),
    });
    added++;
  }
  if (added > 0) save(list);
  return { added, errors };
}

/** 全件を差し替え（設定の一括インポート用） */
export function setAllBankPayments(records: Omit<BankPaymentRecord, "id" | "createdAt">[]): void {
  const list = records.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  save(list);
}

/** 数値として比較可能な形に正規化（カンマ除去など） */
function normalizeAmount(a: string): string {
  return String(a ?? "").replace(/[^0-9０-９]/g, "").trim();
}

function normalizeDate(d: string): string {
  const s = (d ?? "").trim().replace(/\//g, "-");
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return s;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test((d ?? "").trim())) return (d ?? "").trim().replace(/\//g, "-");
  return (d ?? "").trim();
}

/** 案件レコードの6項目と銀行入金データが一致するか */
export function matchBankPayment(
  caseRecord: {
    createdAt?: string;
    receptionNo?: string;
    completionRecipientSpecifiedNo?: string;
    requestSpecifiedNo?: string;
    completionRecipient?: string;
    billingName?: string;
    requestStoreName?: string;
    completionRecipientPostalCode?: string;
    billingPostalCode?: string;
    completionTotalAmount?: string;
  },
  bank: BankPaymentRecord
): boolean {
  const caseDate = normalizeDate((caseRecord.createdAt ?? "").slice(0, 10));
  const bankDate = normalizeDate(bank.invoiceDate);
  if (caseDate !== bankDate) return false;

  const caseReception = (caseRecord.receptionNo ?? "").trim();
  if (caseReception !== (bank.receptionNo ?? "").trim()) return false;

  const caseSpecified = (caseRecord.completionRecipientSpecifiedNo ?? caseRecord.requestSpecifiedNo ?? "").trim();
  if (caseSpecified !== (bank.specifiedNo ?? "").trim()) return false;

  const caseRecipient = (caseRecord.completionRecipient ?? caseRecord.billingName ?? caseRecord.requestStoreName ?? "").trim();
  if (caseRecipient !== (bank.recipientName ?? "").trim()) return false;

  const casePostal = (caseRecord.completionRecipientPostalCode ?? caseRecord.billingPostalCode ?? "").trim();
  if (casePostal !== (bank.postalCode ?? "").trim()) return false;

  const caseAmount = normalizeAmount(caseRecord.completionTotalAmount ?? "");
  const bankAmount = normalizeAmount(bank.amount);
  if (caseAmount !== bankAmount) return false;

  return true;
}

/** 案件に一致する銀行入金データを返す */
export function findMatchingBankPayments(
  caseRecord: Parameters<typeof matchBankPayment>[0]
): BankPaymentRecord[] {
  return load().filter((b) => matchBankPayment(caseRecord, b));
}
