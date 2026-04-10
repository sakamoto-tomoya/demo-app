import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import type { CaseRecord } from "@/lib/types";
import {
  buildRepairHistoryPayloadFromCaseRecord,
  isCaseStatusCompleted,
  registerRepairHistoryToDifyKnowledge,
} from "@/lib/dify-knowledge";

const CASE_TABLE = "case_records";

function normalizeReceptionNo(value?: string): string {
  return (value ?? "").trim();
}

async function ensureCaseTable() {
  const client = getTursoClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS case_records (
      id TEXT PRIMARY KEY,
      reception_no TEXT,
      case_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_case_records_reception_no ON case_records (reception_no)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_case_records_updated_at ON case_records (updated_at)`);
}

function parseCaseJson(raw: unknown): CaseRecord | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as CaseRecord;
  } catch {
    return null;
  }
}

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** 受付JSONの lat/lng を number | null に正規化（未指定・不正値は null） */
function asNullableCoord(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function buildRecordFromLegacyBody(body: Record<string, unknown>): CaseRecord {
  const now = new Date().toISOString();
  const customerName = asTrimmedString(body.customer_name);
  const customerAddress = asTrimmedString(body.customer_address);
  const customerPhone = asTrimmedString(body.customer_phone);
  const inquiry = asTrimmedString(body.inquiry);
  const symptom = asTrimmedString(body.symptom);
  const memo = asTrimmedString(body.note);
  const requestStoreName = asTrimmedString(body.requester_shop_name);
  const requestPhone = asTrimmedString(body.requester_phone);
  const requestContactName = asTrimmedString(body.requester_contact_name);
  const requestAddress = asTrimmedString(body.requester_address);
  const modelName = asTrimmedString(body.model);
  const receptionNo = asTrimmedString(body.reception_no);
  const unconfirmedFields = Array.isArray(body.unconfirmed_fields)
    ? body.unconfirmed_fields.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : undefined;
  return {
    id: crypto.randomUUID(),
    receptionNo: receptionNo || undefined,
    requestStoreName: requestStoreName || undefined,
    requestContactName: requestContactName || undefined,
    requestPhone: requestPhone || undefined,
    requestAddress: requestAddress || undefined,
    customerName: customerName || "未入力",
    postalCode: "",
    address: customerAddress,
    phone: customerPhone,
    modelName: modelName || undefined,
    inquiryContent: inquiry || undefined,
    symptom: symptom || undefined,
    memo,
    status: "new",
    createdAt: now,
    updatedAt: now,
    visitDate: null,
    lat: asNullableCoord(body.lat),
    lng: asNullableCoord(body.lng),
    unconfirmed_fields: unconfirmedFields,
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureCaseTable();
    const client = getTursoClient();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (id) {
      const res = await client.execute({
        sql: `SELECT case_json FROM ${CASE_TABLE} WHERE id = ? LIMIT 1`,
        args: [id],
      });
      if (res.rows.length === 0) return NextResponse.json({ ok: true, case: null });
      const record = parseCaseJson(res.rows[0].case_json);
      return NextResponse.json({ ok: true, case: record });
    }

    const res = await client.execute({
      sql: `SELECT case_json FROM ${CASE_TABLE} ORDER BY updated_at DESC`,
      args: [],
    });
    const cases = res.rows
      .map((row) => parseCaseJson(row.case_json))
      .filter((row): row is CaseRecord => !!row);
    return NextResponse.json({ ok: true, cases });
  } catch (error) {
    console.error("[api/cases] GET error", error);
    return NextResponse.json({ ok: false, error: "案件の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCaseTable();
    const body = (await request.json()) as { record?: CaseRecord } & Record<string, unknown>;
    const record =
      body?.record && typeof body.record === "object"
        ? body.record
        : buildRecordFromLegacyBody(body ?? {});
    if (!record || typeof record !== "object") {
      return NextResponse.json({ ok: false, error: "record の生成に失敗しました。" }, { status: 400 });
    }

    const client = getTursoClient();
    const now = new Date().toISOString();
    const receptionNo = normalizeReceptionNo(record.receptionNo) || null;

    let targetId = record.id || crypto.randomUUID();
    if (receptionNo) {
      const existing = await client.execute({
        sql: `SELECT id FROM ${CASE_TABLE} WHERE reception_no = ? LIMIT 1`,
        args: [receptionNo],
      });
      if (existing.rows.length > 0) {
        targetId = String(existing.rows[0].id);
      }
    }

    const baseCreatedAt = record.createdAt || now;
    const savedRecord: CaseRecord = {
      ...record,
      id: targetId,
      receptionNo: receptionNo ?? undefined,
      createdAt: baseCreatedAt,
      updatedAt: now,
      lat: record.lat ?? null,
      lng: record.lng ?? null,
    };

    const prevRow = await client.execute({
      sql: `SELECT case_json FROM ${CASE_TABLE} WHERE id = ? LIMIT 1`,
      args: [targetId],
    });
    const previousRecord =
      prevRow.rows.length > 0 ? parseCaseJson(prevRow.rows[0].case_json) : null;

    await client.execute({
      sql: `INSERT INTO ${CASE_TABLE} (id, reception_no, case_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              reception_no = excluded.reception_no,
              case_json = excluded.case_json,
              updated_at = excluded.updated_at`,
      args: [targetId, receptionNo, JSON.stringify(savedRecord), baseCreatedAt, now],
    });

    if (
      isCaseStatusCompleted(savedRecord.status) &&
      !isCaseStatusCompleted(previousRecord?.status)
    ) {
      const payload = buildRepairHistoryPayloadFromCaseRecord(savedRecord);
      void registerRepairHistoryToDifyKnowledge(payload);
    }

    return NextResponse.json({ ok: true, case: savedRecord });
  } catch (error) {
    console.error("[api/cases] POST error", error);
    return NextResponse.json({ ok: false, error: "案件の保存に失敗しました。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureCaseTable();
    const body = (await request.json()) as { id?: string; updates?: Partial<CaseRecord> };
    const id = (body.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "id が必要です。" }, { status: 400 });

    const client = getTursoClient();
    const current = await client.execute({
      sql: `SELECT case_json FROM ${CASE_TABLE} WHERE id = ? LIMIT 1`,
      args: [id],
    });
    if (current.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "案件が見つかりません。" }, { status: 404 });
    }

    const existing = parseCaseJson(current.rows[0].case_json);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "案件データの形式が不正です。" }, { status: 500 });
    }
    const now = new Date().toISOString();
    const merged = { ...existing, ...body.updates };
    const next: CaseRecord = {
      ...merged,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      lat: merged.lat ?? null,
      lng: merged.lng ?? null,
    };
    const receptionNo = normalizeReceptionNo(next.receptionNo) || null;
    await client.execute({
      sql: `UPDATE ${CASE_TABLE}
            SET reception_no = ?, case_json = ?, updated_at = ?
            WHERE id = ?`,
      args: [receptionNo, JSON.stringify(next), now, id],
    });

    if (isCaseStatusCompleted(next.status) && !isCaseStatusCompleted(existing.status)) {
      const payload = buildRepairHistoryPayloadFromCaseRecord(next);
      void registerRepairHistoryToDifyKnowledge(payload);
    }

    return NextResponse.json({ ok: true, case: next });
  } catch (error) {
    console.error("[api/cases] PATCH error", error);
    return NextResponse.json({ ok: false, error: "案件の更新に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCaseTable();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ ok: false, error: "id が必要です。" }, { status: 400 });
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM ${CASE_TABLE} WHERE id = ?`,
      args: [id],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/cases] DELETE error", error);
    return NextResponse.json({ ok: false, error: "案件の削除に失敗しました。" }, { status: 500 });
  }
}
