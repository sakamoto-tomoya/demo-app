import { buildClinicIntegrationsJson, parseClinicIntegrations } from "@/lib/clinic-mynumber-demo";
import { getTursoClient } from "@/lib/turso";
import type {
  ClinicIntegrationsPayload,
  ClinicMonitorState,
  ClinicMynumberDemoSummary,
  ClinicOriginType,
  ClinicReceptionPublic,
  ClinicReceptionRow,
  ClinicReceptionStatus,
} from "@/lib/clinic-types";

const TABLE_RECEPTIONS = "clinic_receptions";
const TABLE_MONITOR = "clinic_monitor_state";

/** 自分より前で「まだ順番待ち」とみなす状態 */
const AHEAD_STATUSES: Set<ClinicReceptionStatus> = new Set(["provisional", "checked_in", "waiting"]);

const WAITING_FOR_NEXT: Set<ClinicReceptionStatus> = new Set([
  "provisional",
  "checked_in",
  "waiting",
]);

export async function ensureClinicTables(): Promise<void> {
  const client = getTursoClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_RECEPTIONS} (
      id TEXT PRIMARY KEY,
      service_date TEXT NOT NULL,
      reception_no INTEGER NOT NULL,
      department TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      phone TEXT NOT NULL,
      first_visit INTEGER NOT NULL DEFAULT 1,
      symptom_note TEXT,
      origin_type TEXT NOT NULL DEFAULT 'none',
      origin_text TEXT,
      travel_minutes INTEGER NOT NULL DEFAULT 0,
      notify_push INTEGER NOT NULL DEFAULT 0,
      notify_call INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      session_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      integrations_json TEXT,
      UNIQUE(service_date, reception_no)
    )
  `);
  try {
    await client.execute(`ALTER TABLE ${TABLE_RECEPTIONS} ADD COLUMN integrations_json TEXT`);
  } catch {
    /* 既存カラム */
  }
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_clinic_receptions_date ON ${TABLE_RECEPTIONS}(service_date)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_clinic_receptions_token ON ${TABLE_RECEPTIONS}(session_token)`
  );
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_MONITOR} (
      service_date TEXT PRIMARY KEY,
      calling_reception_no INTEGER,
      next_reception_no INTEGER,
      announcement TEXT,
      avg_consult_minutes INTEGER NOT NULL DEFAULT 15,
      updated_at TEXT NOT NULL
    )
  `);
}

function rowToReception(r: Record<string, unknown>): ClinicReceptionRow {
  const integrationsJson =
    r.integrations_json != null && String(r.integrations_json).trim() !== ""
      ? String(r.integrations_json)
      : null;
  const integrations = parseClinicIntegrations(integrationsJson);
  return {
    id: String(r.id),
    serviceDate: String(r.service_date),
    receptionNo: Number(r.reception_no),
    department: String(r.department),
    patientName: String(r.patient_name),
    birthDate: String(r.birth_date),
    phone: String(r.phone),
    firstVisit: Number(r.first_visit) === 1,
    symptomNote: String(r.symptom_note ?? ""),
    originType: (String(r.origin_type || "none") as ClinicOriginType) || "none",
    originText: String(r.origin_text ?? ""),
    travelMinutes: Number(r.travel_minutes ?? 0),
    notifyPush: Number(r.notify_push) === 1,
    notifyCall: Number(r.notify_call) === 1,
    status: String(r.status) as ClinicReceptionStatus,
    sessionToken: String(r.session_token),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    integrationsJson,
    integrations,
  };
}

function mynumberSummary(i: ClinicIntegrationsPayload | null): ClinicMynumberDemoSummary | null {
  if (!i) return null;
  const rawPref = i.mynumberSnapshot?.registeredAddressPrefecture ?? null;
  const mynumberAddressPrefecture =
    rawPref === "ALL" ? "全国" : rawPref && rawPref.length > 0 ? rawPref : null;
  return {
    linked: true,
    hospitalLine: `${i.familyHospital.name}（${i.familyHospital.city}）`,
    prescriptionCount: i.prescriptions.length,
    prescriptionLabels: i.prescriptions.map((p) => p.label),
    mynumberAddressPrefecture,
  };
}

export function receptionToPublic(r: ClinicReceptionRow): ClinicReceptionPublic {
  const { sessionToken: _st, phone, integrationsJson: _ij, integrations, ...rest } = r;
  return {
    ...rest,
    phoneMasked: maskPhone(phone),
    mynumberDemo: mynumberSummary(integrations),
  };
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `***-****-${d.slice(-4)}`;
}

export async function ensureMonitorRow(serviceDate: string): Promise<void> {
  const client = getTursoClient();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO ${TABLE_MONITOR} (service_date, calling_reception_no, next_reception_no, announcement, avg_consult_minutes, updated_at)
          VALUES (?, NULL, NULL, '', 15, ?)
          ON CONFLICT(service_date) DO NOTHING`,
    args: [serviceDate, now],
  });
}

async function getAvgConsultMinutes(serviceDate: string): Promise<number> {
  await ensureMonitorRow(serviceDate);
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT avg_consult_minutes FROM ${TABLE_MONITOR} WHERE service_date = ? LIMIT 1`,
    args: [serviceDate],
  });
  if (res.rows.length === 0) return 15;
  return Math.max(1, Number(res.rows[0].avg_consult_minutes ?? 15));
}

function computeNextNo(
  rows: ClinicReceptionRow[],
  callingNo: number | null
): number | null {
  const waiting = rows
    .filter((x) => WAITING_FOR_NEXT.has(x.status))
    .map((x) => x.receptionNo)
    .sort((a, b) => a - b);
  if (waiting.length === 0) return null;
  if (callingNo == null) return waiting[0] ?? null;
  const after = waiting.filter((n) => n > callingNo);
  return after[0] ?? waiting[0] ?? null;
}

export async function getMonitorState(serviceDate: string): Promise<ClinicMonitorState> {
  await ensureClinicTables();
  await ensureMonitorRow(serviceDate);
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE_MONITOR} WHERE service_date = ? LIMIT 1`,
    args: [serviceDate],
  });
  const m = res.rows[0] as Record<string, unknown>;
  const list = await listReceptionsInternal(serviceDate);
  const calling = m?.calling_reception_no != null ? Number(m.calling_reception_no) : null;
  const next = computeNextNo(list, calling);
  return {
    serviceDate,
    callingReceptionNo: calling,
    nextReceptionNo: next,
    announcement: String(m?.announcement ?? ""),
    avgConsultMinutes: Math.max(1, Number(m?.avg_consult_minutes ?? 15)),
    updatedAt: String(m?.updated_at ?? new Date().toISOString()),
  };
}

async function listReceptionsInternal(serviceDate: string): Promise<ClinicReceptionRow[]> {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE_RECEPTIONS} WHERE service_date = ? ORDER BY reception_no ASC`,
    args: [serviceDate],
  });
  return res.rows.map((row) => rowToReception(row as Record<string, unknown>));
}

export async function listReceptionsForAdmin(serviceDate: string): Promise<ClinicReceptionPublic[]> {
  await ensureClinicTables();
  const rows = await listReceptionsInternal(serviceDate);
  return rows.map(receptionToPublic);
}

export async function createReception(input: {
  serviceDate: string;
  department: string;
  patientName: string;
  birthDate: string;
  phone: string;
  firstVisit: boolean;
  symptomNote: string;
  originType: ClinicOriginType;
  originText: string;
  travelMinutes: number;
  notifyPush: boolean;
  notifyCall: boolean;
  mynumberDemo?: {
    enabled: boolean;
    familyHospitalId: string;
    prescriptionIds: string[];
    /** マイナ登録住所として参照した都道府県、または ALL */
    mynumberRegisteredPrefecture: string;
  };
}): Promise<{ ok: true; reception: ClinicReceptionRow } | { ok: false; error: string }> {
  await ensureClinicTables();
  const department = input.department.trim();
  const patientName = input.patientName.trim();
  const birthDate = input.birthDate.trim();
  const phone = input.phone.trim();
  if (!department) return { ok: false, error: "診療科を入力してください。" };
  if (!patientName) return { ok: false, error: "氏名を入力してください。" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return { ok: false, error: "生年月日は YYYY-MM-DD で入力してください。" };
  if (!phone) return { ok: false, error: "電話番号を入力してください。" };

  let integrationsJson: string | null = null;
  const demo = input.mynumberDemo;
  if (demo?.enabled) {
    const hid = String(demo.familyHospitalId ?? "").trim();
    if (!hid) {
      return { ok: false, error: "マイナ連携を使う場合は、かかりつけの医療機関を選択してください。" };
    }
    const regPref = String(demo.mynumberRegisteredPrefecture ?? "ALL").trim() || "ALL";
    integrationsJson = buildClinicIntegrationsJson({
      enabled: true,
      familyHospitalId: hid,
      prescriptionIds: Array.isArray(demo.prescriptionIds) ? demo.prescriptionIds : [],
      mynumberRegisteredPrefecture: regPref,
    });
    if (!integrationsJson) {
      return {
        ok: false,
        error:
          "かかりつけ医療機関の選択が不正です。マイナ情報で取得した候補から選び直してください。",
      };
    }
  }

  await ensureMonitorRow(input.serviceDate);
  const client = getTursoClient();
  const maxRes = await client.execute({
    sql: `SELECT MAX(reception_no) AS mx FROM ${TABLE_RECEPTIONS} WHERE service_date = ?`,
    args: [input.serviceDate],
  });
  const nextNo = Number(maxRes.rows[0]?.mx ?? 0) + 1;
  const id = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const status: ClinicReceptionStatus = "waiting";

  await client.execute({
    sql: `INSERT INTO ${TABLE_RECEPTIONS}
      (id, service_date, reception_no, department, patient_name, birth_date, phone, first_visit, symptom_note,
       origin_type, origin_text, travel_minutes, notify_push, notify_call, status, session_token, created_at, updated_at,
       integrations_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.serviceDate,
      nextNo,
      department,
      patientName,
      birthDate,
      phone,
      input.firstVisit ? 1 : 0,
      input.symptomNote.trim(),
      input.originType,
      input.originText.trim(),
      Math.max(0, Math.min(180, Math.floor(input.travelMinutes))),
      input.notifyPush ? 1 : 0,
      input.notifyCall ? 1 : 0,
      status,
      sessionToken,
      now,
      now,
      integrationsJson,
    ],
  });

  const created = await getReceptionById(id);
  if (!created) return { ok: false, error: "登録に失敗しました。" };
  return { ok: true, reception: created };
}

export async function getReceptionById(id: string): Promise<ClinicReceptionRow | null> {
  await ensureClinicTables();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE_RECEPTIONS} WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  return rowToReception(res.rows[0] as Record<string, unknown>);
}

export async function getReceptionByToken(token: string): Promise<ClinicReceptionRow | null> {
  await ensureClinicTables();
  const t = token.trim();
  if (!t) return null;
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE_RECEPTIONS} WHERE session_token = ? LIMIT 1`,
    args: [t],
  });
  if (res.rows.length === 0) return null;
  return rowToReception(res.rows[0] as Record<string, unknown>);
}

export async function countAhead(serviceDate: string, receptionNo: number): Promise<number> {
  const rows = await listReceptionsInternal(serviceDate);
  return rows.filter((r) => AHEAD_STATUSES.has(r.status) && r.receptionNo < receptionNo).length;
}

export type PatientStatusPayload = {
  receptionNo: number;
  status: ClinicReceptionStatus;
  department: string;
  aheadCount: number;
  estimatedWaitMinutes: number;
  currentCallingNo: number | null;
  nextNo: number | null;
  announcement: string;
  travelMinutes: number;
  departureHint: string;
  notifyPush: boolean;
  notifyCall: boolean;
  mynumberDemo: ClinicMynumberDemoSummary | null;
};

export async function getPatientStatusPayload(token: string): Promise<PatientStatusPayload | null> {
  const r = await getReceptionByToken(token);
  if (!r) return null;
  const monitor = await getMonitorState(r.serviceDate);
  const ahead = await countAhead(r.serviceDate, r.receptionNo);
  const est = ahead * monitor.avgConsultMinutes;
  let departureHint = "";
  if (r.travelMinutes > 0) {
    if (ahead <= 0) {
      departureHint = "まもなく呼び出しの可能性があります。病院へ向かう準備をしてください。";
    } else if (ahead * monitor.avgConsultMinutes <= r.travelMinutes + 10) {
      departureHint = "そろそろ出発してもよいタイミングです。";
    } else {
      departureHint = "現時点では院内待ちが長めです。しばらくお待ちいただいてからの出発で構いません。";
    }
  } else {
    departureHint = "移動時間が未設定のため、出発タイミングは目安のみです。";
  }
  return {
    receptionNo: r.receptionNo,
    status: r.status,
    department: r.department,
    aheadCount: ahead,
    estimatedWaitMinutes: est,
    currentCallingNo: monitor.callingReceptionNo,
    nextNo: monitor.nextReceptionNo,
    announcement: monitor.announcement,
    travelMinutes: r.travelMinutes,
    departureHint,
    notifyPush: r.notifyPush,
    notifyCall: r.notifyCall,
    mynumberDemo: mynumberSummary(r.integrations),
  };
}

const ALLOWED_STATUS: Set<ClinicReceptionStatus> = new Set([
  "provisional",
  "checked_in",
  "waiting",
  "calling",
  "in_consultation",
  "done",
  "absent",
  "cancelled",
]);

export async function updateReceptionStatus(
  id: string,
  status: ClinicReceptionStatus
): Promise<{ ok: true; reception: ClinicReceptionRow } | { ok: false; error: string }> {
  if (!ALLOWED_STATUS.has(status)) return { ok: false, error: "不正な状態です。" };
  await ensureClinicTables();
  const existing = await getReceptionById(id);
  if (!existing) return { ok: false, error: "受付が見つかりません。" };
  const now = new Date().toISOString();
  const client = getTursoClient();
  await client.execute({
    sql: `UPDATE ${TABLE_RECEPTIONS} SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, now, id],
  });
  const updated = await getReceptionById(id);
  if (!updated) return { ok: false, error: "更新に失敗しました。" };
  await reconcileMonitorIfCallingCleared(updated.serviceDate, updated.receptionNo, status);
  return { ok: true, reception: updated };
}

async function reconcileMonitorIfCallingCleared(
  serviceDate: string,
  receptionNo: number,
  newStatus: ClinicReceptionStatus
): Promise<void> {
  if (!["done", "absent", "cancelled", "in_consultation"].includes(newStatus)) return;
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT calling_reception_no FROM ${TABLE_MONITOR} WHERE service_date = ? LIMIT 1`,
    args: [serviceDate],
  });
  const calling = res.rows[0]?.calling_reception_no;
  if (calling == null || Number(calling) !== receptionNo) return;
  const list = await listReceptionsInternal(serviceDate);
  const next = computeNextNo(list, null);
  const now = new Date().toISOString();
  await client.execute({
    sql: `UPDATE ${TABLE_MONITOR} SET calling_reception_no = NULL, next_reception_no = ?, updated_at = ? WHERE service_date = ?`,
    args: [next, now, serviceDate],
  });
}

export async function callReception(
  id: string
): Promise<{ ok: true; monitor: ClinicMonitorState } | { ok: false; error: string }> {
  await ensureClinicTables();
  const r = await getReceptionById(id);
  if (!r) return { ok: false, error: "受付が見つかりません。" };
  await ensureMonitorRow(r.serviceDate);
  const now = new Date().toISOString();
  const client = getTursoClient();
  await client.execute({
    sql: `UPDATE ${TABLE_RECEPTIONS} SET status = 'waiting', updated_at = ? WHERE service_date = ? AND status = 'calling' AND id != ?`,
    args: [now, r.serviceDate, id],
  });
  await client.execute({
    sql: `UPDATE ${TABLE_RECEPTIONS} SET status = 'calling', updated_at = ? WHERE id = ?`,
    args: [now, id],
  });
  const list = await listReceptionsInternal(r.serviceDate);
  const next = computeNextNo(
    list.map((x) => (x.id === id ? { ...x, status: "calling" as const } : x)),
    r.receptionNo
  );
  await client.execute({
    sql: `UPDATE ${TABLE_MONITOR}
        SET calling_reception_no = ?, next_reception_no = ?, updated_at = ?
        WHERE service_date = ?`,
    args: [r.receptionNo, next, now, r.serviceDate],
  });
  const monitor = await getMonitorState(r.serviceDate);
  return { ok: true, monitor };
}

export async function updateMonitorAnnouncement(
  serviceDate: string,
  announcement: string,
  avgConsultMinutes?: number
): Promise<{ ok: true; monitor: ClinicMonitorState }> {
  await ensureClinicTables();
  await ensureMonitorRow(serviceDate);
  const now = new Date().toISOString();
  const client = getTursoClient();
  const avg =
    avgConsultMinutes != null
      ? Math.max(1, Math.min(120, Math.floor(avgConsultMinutes)))
      : await getAvgConsultMinutes(serviceDate);
  await client.execute({
    sql: `UPDATE ${TABLE_MONITOR} SET announcement = ?, avg_consult_minutes = ?, updated_at = ? WHERE service_date = ?`,
    args: [announcement.trim().slice(0, 500), avg, now, serviceDate],
  });
  return { ok: true, monitor: await getMonitorState(serviceDate) };
}
