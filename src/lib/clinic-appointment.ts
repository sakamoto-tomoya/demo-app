import {
  buildClinicIntegrationsJson,
  DEMO_FAMILY_HOSPITALS,
  parseClinicIntegrations,
} from "@/lib/clinic-mynumber-demo";
import {
  clinicAppointmentWindowDays,
  generateClinicSlotStarts,
  isClinicOpenOnDate,
  isKnownClinicHospitalId,
} from "@/lib/clinic-hospital-schedule";
import type {
  ClinicAppointmentPublic,
  ClinicAppointmentStatus,
  ClinicIntegrationsPayload,
  ClinicMynumberDemoSummary,
  ClinicOriginType,
} from "@/lib/clinic-types";
import { getTursoClient } from "@/lib/turso";

const TABLE = "clinic_appointments";

export type ClinicAppointmentRow = {
  id: string;
  hospitalId: string;
  appointmentDate: string;
  startTime: string;
  durationMinutes: number;
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
  integrationsJson: string | null;
  integrations: ClinicIntegrationsPayload | null;
  sessionToken: string;
  status: ClinicAppointmentStatus;
  createdAt: string;
  updatedAt: string;
};

function todayYmdTokyo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function ymdInBookingWindow(ymd: string): boolean {
  const t0 = todayYmdTokyo();
  const t1 = addDaysYmd(t0, clinicAppointmentWindowDays());
  return ymd >= t0 && ymd <= t1;
}

export async function ensureClinicAppointmentsTable(): Promise<void> {
  const client = getTursoClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
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
      integrations_json TEXT,
      session_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(hospital_id, appointment_date, start_time)
    )
  `);
  try {
    await client.execute(`ALTER TABLE ${TABLE} ADD COLUMN integrations_json TEXT`);
  } catch {
    /* exists */
  }
}

function rowToAppointment(r: Record<string, unknown>): ClinicAppointmentRow {
  const integrationsJson =
    r.integrations_json != null && String(r.integrations_json).trim() !== ""
      ? String(r.integrations_json)
      : null;
  return {
    id: String(r.id),
    hospitalId: String(r.hospital_id),
    appointmentDate: String(r.appointment_date),
    startTime: String(r.start_time),
    durationMinutes: Number(r.duration_minutes ?? 30),
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
    integrationsJson,
    integrations: parseClinicIntegrations(integrationsJson),
    sessionToken: String(r.session_token),
    status: String(r.status) as ClinicAppointmentStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `***-****-${d.slice(-4)}`;
}

function hospitalLabel(id: string): string {
  return DEMO_FAMILY_HOSPITALS.find((h) => h.id === id)?.name ?? id;
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

export function appointmentToPublic(a: ClinicAppointmentRow): ClinicAppointmentPublic {
  const { phone, sessionToken: _st, integrationsJson: _j, integrations, ...rest } = a;
  return {
    ...rest,
    phoneMasked: maskPhone(phone),
    hospitalName: hospitalLabel(a.hospitalId),
    mynumberDemo: mynumberSummary(integrations),
  };
}

export async function listBookedStartTimes(hospitalId: string, ymd: string): Promise<Set<string>> {
  await ensureClinicAppointmentsTable();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT start_time FROM ${TABLE}
          WHERE hospital_id = ? AND appointment_date = ? AND status != 'cancelled'`,
    args: [hospitalId, ymd],
  });
  return new Set(res.rows.map((row) => String((row as Record<string, unknown>).start_time)));
}

export async function getClinicAvailability(hospitalId: string, ymd: string): Promise<string[]> {
  if (!isKnownClinicHospitalId(hospitalId)) return [];
  if (!ymdInBookingWindow(ymd)) return [];
  if (!isClinicOpenOnDate(hospitalId, ymd)) return [];
  const all = generateClinicSlotStarts(hospitalId, ymd);
  const booked = await listBookedStartTimes(hospitalId, ymd);
  return all.filter((s) => !booked.has(s));
}

export async function createClinicAppointment(input: {
  hospitalId: string;
  appointmentDate: string;
  startTime: string;
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
    mynumberRegisteredPrefecture: string;
  };
}): Promise<{ ok: true; appointment: ClinicAppointmentRow } | { ok: false; error: string }> {
  await ensureClinicAppointmentsTable();
  const hid = input.hospitalId.trim();
  if (!isKnownClinicHospitalId(hid)) return { ok: false, error: "医療機関が不正です。" };
  const ad = input.appointmentDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ad)) return { ok: false, error: "予約日が不正です。" };
  if (!ymdInBookingWindow(ad)) return { ok: false, error: "予約できる期間外です。" };
  if (!isClinicOpenOnDate(hid, ad)) return { ok: false, error: "この日は診療がありません。" };
  const st = input.startTime.trim();
  if (!/^\d{2}:\d{2}$/.test(st)) return { ok: false, error: "予約時間が不正です。" };
  const available = await getClinicAvailability(hid, ad);
  if (!available.includes(st)) return { ok: false, error: "この時間は予約できません。別の枠を選んでください。" };

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
    if (String(demo.familyHospitalId).trim() !== hid) {
      return { ok: false, error: "マイナ連携の医療機関と予約先が一致しません。" };
    }
    integrationsJson = buildClinicIntegrationsJson({
      enabled: true,
      familyHospitalId: hid,
      prescriptionIds: Array.isArray(demo.prescriptionIds) ? demo.prescriptionIds : [],
      mynumberRegisteredPrefecture: String(demo.mynumberRegisteredPrefecture ?? "ALL").trim() || "ALL",
    });
    if (!integrationsJson) return { ok: false, error: "マイナ連携データの生成に失敗しました。" };
  }

  const id = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const client = getTursoClient();
  try {
    await client.execute({
      sql: `INSERT INTO ${TABLE}
        (id, hospital_id, appointment_date, start_time, duration_minutes, department, patient_name, birth_date, phone,
         first_visit, symptom_note, origin_type, origin_text, travel_minutes, notify_push, notify_call,
         integrations_json, session_token, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 30, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
      args: [
        id,
        hid,
        ad,
        st,
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
        integrationsJson,
        sessionToken,
        now,
        now,
      ],
    });
  } catch {
    return { ok: false, error: "この枠は先に埋まりました。別の時間を選んでください。" };
  }

  const created = await getClinicAppointmentById(id);
  if (!created) return { ok: false, error: "登録に失敗しました。" };
  return { ok: true, appointment: created };
}

export async function getClinicAppointmentById(id: string): Promise<ClinicAppointmentRow | null> {
  await ensureClinicAppointmentsTable();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  return rowToAppointment(res.rows[0] as Record<string, unknown>);
}

export async function getClinicAppointmentByToken(token: string): Promise<ClinicAppointmentRow | null> {
  await ensureClinicAppointmentsTable();
  const t = token.trim();
  if (!t) return null;
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE} WHERE session_token = ? LIMIT 1`,
    args: [t],
  });
  if (res.rows.length === 0) return null;
  return rowToAppointment(res.rows[0] as Record<string, unknown>);
}

export async function listClinicAppointments(params: {
  hospitalId?: string;
  date?: string;
}): Promise<ClinicAppointmentRow[]> {
  await ensureClinicAppointmentsTable();
  const client = getTursoClient();
  if (params.hospitalId && params.date) {
    const res = await client.execute({
      sql: `SELECT * FROM ${TABLE} WHERE hospital_id = ? AND appointment_date = ? ORDER BY start_time ASC`,
      args: [params.hospitalId, params.date],
    });
    return res.rows.map((row) => rowToAppointment(row as Record<string, unknown>));
  }
  if (params.date) {
    const res = await client.execute({
      sql: `SELECT * FROM ${TABLE} WHERE appointment_date = ? ORDER BY hospital_id, start_time ASC`,
      args: [params.date],
    });
    return res.rows.map((row) => rowToAppointment(row as Record<string, unknown>));
  }
  const res = await client.execute({
    sql: `SELECT * FROM ${TABLE} ORDER BY appointment_date DESC, start_time ASC LIMIT 200`,
    args: [],
  });
  return res.rows.map((row) => rowToAppointment(row as Record<string, unknown>));
}

const ALLOWED_STATUS: Set<ClinicAppointmentStatus> = new Set([
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export async function updateClinicAppointmentStatus(
  id: string,
  status: ClinicAppointmentStatus
): Promise<{ ok: true; appointment: ClinicAppointmentRow } | { ok: false; error: string }> {
  if (!ALLOWED_STATUS.has(status)) return { ok: false, error: "不正な状態です。" };
  await ensureClinicAppointmentsTable();
  const existing = await getClinicAppointmentById(id);
  if (!existing) return { ok: false, error: "予約が見つかりません。" };
  const now = new Date().toISOString();
  const client = getTursoClient();
  await client.execute({
    sql: `UPDATE ${TABLE} SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, now, id],
  });
  const updated = await getClinicAppointmentById(id);
  if (!updated) return { ok: false, error: "更新に失敗しました。" };
  return { ok: true, appointment: updated };
}

export type ClinicAppointmentPatientPayload = {
  hospitalId: string;
  hospitalName: string;
  appointmentDate: string;
  startTime: string;
  durationMinutes: number;
  department: string;
  status: ClinicAppointmentStatus;
  travelMinutes: number;
  departureHint: string;
  notifyPush: boolean;
  notifyCall: boolean;
  mynumberDemo: ClinicMynumberDemoSummary | null;
};

export function getClinicAppointmentPatientPayload(
  a: ClinicAppointmentRow
): ClinicAppointmentPatientPayload {
  const t0 = todayYmdTokyo();
  let departureHint = "";
  if (a.travelMinutes > 0) {
    if (a.appointmentDate > t0) {
      departureHint = `予約日は ${a.appointmentDate} です。当日は約${a.travelMinutes}分前の出発目安です。`;
    } else if (a.appointmentDate === t0) {
      departureHint = `本日の予約です。約${a.travelMinutes}分かけてお越しください。`;
    } else {
      departureHint = "予約日を過ぎています。必要なら受付にご連絡ください（デモ）。";
    }
  } else {
    departureHint = "移動時間が未設定のため、出発の目安は自己判断となります。";
  }
  return {
    hospitalId: a.hospitalId,
    hospitalName: hospitalLabel(a.hospitalId),
    appointmentDate: a.appointmentDate,
    startTime: a.startTime,
    durationMinutes: a.durationMinutes,
    department: a.department,
    status: a.status,
    travelMinutes: a.travelMinutes,
    departureHint,
    notifyPush: a.notifyPush,
    notifyCall: a.notifyCall,
    mynumberDemo: mynumberSummary(a.integrations),
  };
}
