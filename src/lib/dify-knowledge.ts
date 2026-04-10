/**
 * Dify Knowledge（データセット）へテキストドキュメントを登録する。
 * POST {DIFY_BASE_URL}/datasets/{dataset_id}/document/create_by_text
 * Authorization: Bearer {DIFY_KNOWLEDGE_API_KEY}
 * Content-Type: application/json
 * - 受付: DIFY_RECEPTION_KNOWLEDGE_DATASET_ID（未設定時は受付ナレッジへは登録しない）
 * - Web完了・学習登録: DIFY_KNOWLEDGE_DATASET_ID
 * - 修理履歴: DIFY_REPAIR_HISTORY_DATASET_ID
 */

import type { CaseRecord } from "./types";
import { CASE_STATUS_LABELS } from "./types";

function getDifyApiBase(): string {
  const b = process.env.DIFY_BASE_URL?.replace(/\/$/, "").trim();
  return b || "https://api.dify.ai/v1";
}
/** ナレッジ文書の新規作成 API パス（アンダースコア） */
const CREATE_DOCUMENT_PATH = "document/create_by_text";

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/** 受付ナレッジ用 */
export type ReceptionKnowledgePayload = {
  reception_no: string;
  requester_shop_name: string;
  requester_phone: string;
  requester_contact_name?: string;
  requester_address?: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  model: string;
  symptom: string;
  inquiry: string;
  case_id?: string;
};

/** 修理履歴ナレッジ用（受付内容 ＋ 修理内容・使用部品・完了日） */
export type RepairHistoryKnowledgePayload = ReceptionKnowledgePayload & {
  work_detail: string;
  used_parts_text: string;
  completion_date: string;
};

export type DifyKnowledgeRegisterResult =
  | { success: true }
  | { success: false; error: string };

function buildReceptionKnowledgeText(p: ReceptionKnowledgePayload): string {
  const lines: string[] = [
    `受付番号: ${str(p.reception_no) || "(未入力)"}`,
    `依頼元店名: ${str(p.requester_shop_name) || "(未入力)"}`,
    `依頼元電話番号: ${str(p.requester_phone) || "(未入力)"}`,
  ];
  if (str(p.requester_contact_name)) {
    lines.push(`依頼元担当: ${str(p.requester_contact_name)}`);
  }
  if (str(p.requester_address)) {
    lines.push(`依頼元住所: ${str(p.requester_address)}`);
  }
  lines.push(
    `お客様名: ${str(p.customer_name) || "(未入力)"}`,
    `お客様住所: ${str(p.customer_address) || "(未入力)"}`,
    `お客様電話番号: ${str(p.customer_phone) || "(未入力)"}`,
    `型式: ${str(p.model) || "(未入力)"}`,
    `症状: ${str(p.symptom) || "(未入力)"}`,
    `問合内容: ${str(p.inquiry) || "(未入力)"}`
  );
  return lines.join("\n");
}

export function buildRepairHistoryKnowledgeText(p: RepairHistoryKnowledgePayload): string {
  const base = buildReceptionKnowledgeText(p);
  const completion = str(p.completion_date);
  const completionLabel = completion
    ? (() => {
        try {
          const d = new Date(completion);
          if (!Number.isNaN(d.getTime())) {
            return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
          }
        } catch {
          /* fall through */
        }
        return completion;
      })()
    : "(未入力)";
  const extra = [
    "",
    "【修理内容】",
    str(p.work_detail) || "(未入力)",
    "",
    "【使用部品】",
    str(p.used_parts_text) || "(未入力)",
    "",
    `完了日: ${completionLabel}`,
  ].join("\n");
  return `${base}\n${extra}`;
}

/** UIラベル「完了」・英語表記・正規キー completed のいずれでも完了とみなす */
export function isCaseStatusCompleted(status: unknown): boolean {
  if (status === null || status === undefined) return false;
  const raw = String(status).trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower === "completed" || lower === "complete") return true;
  if (raw === CASE_STATUS_LABELS.completed) return true;
  if (raw === "完了") return true;
  return false;
}

function buildUsedPartsTextFromCaseRecord(record: CaseRecord): string {
  const lines: string[] = [];
  const partName = (record.completionPartsUsed ?? "").split("\n");
  const partNo = (record.completionPartsPartNo ?? "").split("\n");
  const qty = (record.completionPartsQty ?? "").split("\n");
  const n = Math.max(partName.length, partNo.length, qty.length, 1);
  for (let i = 0; i < n; i++) {
    const pn = (partNo[i] ?? "").trim();
    if (!pn) continue;
    const qRaw = (qty[i] ?? "").trim();
    const qNum = Number(qRaw.replace(/,/g, ""));
    const qtySuffix = qRaw && !Number.isNaN(qNum) && qNum > 1 ? ` ×${qRaw}` : "";
    const name = (partName[i] ?? "").trim();
    lines.push(`${pn}${qtySuffix}${name ? ` ${name}` : ""}`.trim());
  }
  if (lines.length === 0 && record.completionDetail) {
    const d = record.completionDetail;
    const singlePn = str(d.part_number);
    const singleName = str(d.part_name);
    if (singlePn || singleName) {
      lines.push([singlePn, singleName].filter(Boolean).join(" "));
    }
  }
  return lines.join("\n");
}

/** Turso に保存済みの CaseRecord から修理履歴ナレッジ用ペイロードを組み立てる */
export function buildRepairHistoryPayloadFromCaseRecord(record: CaseRecord): RepairHistoryKnowledgePayload {
  const workDetail =
    str(record.completionDetail?.work_detail) || str(record.completionRepairDetail);
  const completionDateIso = (() => {
    const d = str(record.completionDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return `${d}T12:00:00.000Z`;
    }
    return str(record.updatedAt) || new Date().toISOString();
  })();

  return {
    reception_no: str(record.receptionNo),
    requester_shop_name: str(record.requestStoreName),
    requester_phone: str(record.requestPhone),
    requester_contact_name: record.requestContactName ? str(record.requestContactName) : undefined,
    requester_address: record.requestAddress ? str(record.requestAddress) : undefined,
    customer_name: str(record.customerName),
    customer_address: str(record.address),
    customer_phone: str(record.phone),
    model: str(record.modelName),
    symptom: str(record.symptom),
    inquiry: str(record.inquiryContent),
    case_id: record.id,
    work_detail: workDetail,
    used_parts_text: buildUsedPartsTextFromCaseRecord(record),
    completion_date: completionDateIso,
  };
}

type KnowledgeLogKind = "reception" | "repair";

function logSuccess(kind: KnowledgeLogKind, receptionForLog: string): void {
  const ref = receptionForLog || "未入力";
  if (kind === "reception") {
    console.log(`[dify-knowledge] 受付ナレッジ登録成功: 受付番号${ref}`);
  } else {
    console.log(`[dify-knowledge] 修理履歴登録成功: 受付番号${ref}`);
  }
}

function logFailure(kind: KnowledgeLogKind, receptionForLog: string, detail: string): void {
  const ref = receptionForLog || "未入力";
  if (kind === "reception") {
    console.error(`[dify-knowledge] 受付ナレッジ登録失敗: 受付番号${ref} | ${detail}`);
  } else {
    console.error(`[dify-knowledge] 修理履歴ナレッジ登録失敗: 受付番号${ref} | ${detail}`);
  }
}

function logSkip(kind: KnowledgeLogKind, reason: string): void {
  if (kind === "reception") {
    console.log(`[dify-knowledge] 受付ナレッジスキップ: ${reason}`);
  } else {
    console.log(`[dify-knowledge] 修理履歴ナレッジスキップ: ${reason}`);
  }
}

async function createDocumentInDataset(
  datasetId: string | undefined,
  apiKey: string | undefined,
  opts: {
    docName: string;
    text: string;
    logKind: KnowledgeLogKind;
    receptionForLog: string;
  }
): Promise<DifyKnowledgeRegisterResult> {
  if (!apiKey || !datasetId) {
    logSkip(
      opts.logKind,
      opts.logKind === "reception"
        ? "APIキーまたは DIFY_KNOWLEDGE_DATASET_ID 未設定"
        : "APIキーまたは DIFY_REPAIR_HISTORY_DATASET_ID 未設定"
    );
    return { success: true };
  }

  const url = `${getDifyApiBase()}/datasets/${encodeURIComponent(datasetId)}/${CREATE_DOCUMENT_PATH}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: opts.docName,
        text: opts.text,
        indexing_technique: "high_quality",
        process_rule: { mode: "automatic" },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      document?: { id?: string };
      data?: { document?: { id?: string } };
    };

    const docId = data?.document?.id ?? data?.data?.document?.id;
    const logRef = opts.receptionForLog || "未入力";

    if (!res.ok) {
      const message = data?.message ?? `HTTP ${res.status}`;
      logFailure(opts.logKind, logRef, `${message}（案件保存は成功のまま）`);
      return { success: false, error: message };
    }

    if (!docId) {
      const message = "Dify が 200 を返しましたが document.id がありません";
      logFailure(opts.logKind, logRef, `${message}（案件保存は成功のまま）`);
      return { success: false, error: message };
    }

    logSuccess(opts.logKind, logRef);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const logRef = opts.receptionForLog || "未入力";
    logFailure(opts.logKind, logRef, `${message}（案件保存は成功のまま）`);
    return { success: false, error: message };
  }
}

/**
 * 案件保存直後 → 受付ナレッジへ登録。失敗しても呼び出し元の保存成功には影響しない。
 */
export async function registerReceptionToDifyKnowledge(
  payload: ReceptionKnowledgePayload
): Promise<DifyKnowledgeRegisterResult> {
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
  const datasetId = process.env.DIFY_RECEPTION_KNOWLEDGE_DATASET_ID?.trim();

  if (!apiKey || !datasetId) {
    logSkip(
      "reception",
      "DIFY_KNOWLEDGE_API_KEY または DIFY_RECEPTION_KNOWLEDGE_DATASET_ID 未設定（受付ナレッジは未同期）"
    );
    return { success: true };
  }

  const reception = str(payload.reception_no);
  const docName = reception
    ? `受付番号_${reception}`
    : `受付番号_${str(payload.case_id).slice(0, 8) || "new"}`;

  return createDocumentInDataset(datasetId, apiKey, {
    docName,
    text: buildReceptionKnowledgeText(payload),
    logKind: "reception",
    receptionForLog: reception || "未入力",
  });
}

/**
 * 案件完了時 → 修理履歴ナレッジへ登録。失敗しても保存成功には影響しない。
 */
export async function registerRepairHistoryToDifyKnowledge(
  payload: RepairHistoryKnowledgePayload
): Promise<DifyKnowledgeRegisterResult> {
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
  const datasetId = process.env.DIFY_REPAIR_HISTORY_DATASET_ID?.trim();

  if (!apiKey || !datasetId) {
    logSkip("repair", "DIFY_KNOWLEDGE_API_KEY または DIFY_REPAIR_HISTORY_DATASET_ID 未設定");
    return { success: true };
  }

  const reception = str(payload.reception_no);
  const stamp = str(payload.completion_date).slice(0, 10) || "nodate";
  const docName = reception
    ? `修理履歴_${reception}_${stamp}`
    : `修理履歴_${str(payload.case_id).slice(0, 8) || "new"}_${stamp}`;

  return createDocumentInDataset(datasetId, apiKey, {
    docName,
    text: buildRepairHistoryKnowledgeText(payload),
    logKind: "repair",
    receptionForLog: reception || "未入力",
  });
}

/** @deprecated 互換用。 */
export type CaseKnowledgePayload = ReceptionKnowledgePayload;

/** @deprecated 互換用。 */
export async function registerCaseDocumentToDifyKnowledge(
  payload: CaseKnowledgePayload
): Promise<DifyKnowledgeRegisterResult> {
  return registerReceptionToDifyKnowledge(payload);
}
