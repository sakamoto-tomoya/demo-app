import { getTursoClient } from "@/lib/turso";
import type {
  AvailabilitySlot,
  RestaurantMenu,
  RestaurantNotification,
  RestaurantReservation,
  ReservationStatus,
} from "@/lib/restaurant-types";
import nodemailer from "nodemailer";
import { getEmailConfig } from "@/lib/email-config";

const MENU_TABLE = "restaurant_menus";
const RESERVATION_TABLE = "restaurant_reservations";
const SETTINGS_TABLE = "restaurant_settings";
const NOTIFICATION_TABLE = "restaurant_notifications";

const SLOT_MINUTES = 30;
const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

const DEFAULT_MENUS: RestaurantMenu[] = [
  {
    id: "menu_lunch_set",
    name: "ランチセット",
    description: "フレンチの定番ランチを短時間で楽しめるプラン",
    price: 2200,
    durationMinutes: 60,
    minPeople: 1,
    maxPeople: 5,
    isActive: true,
    imageUrl: "/images/restaurant/menu-lunch.png?v=3",
  },
  {
    id: "menu_dinner_course",
    name: "ディナーコース",
    description: "ゆっくり食事を楽しむ定番コース",
    price: 4800,
    durationMinutes: 90,
    minPeople: 1,
    maxPeople: 6,
    isActive: true,
    imageUrl: "/images/restaurant/menu-dinner.png?v=3",
  },
  {
    id: "menu_anniversary",
    name: "記念日コース",
    description: "特別な日に向けたフルコース",
    price: 8000,
    durationMinutes: 120,
    minPeople: 2,
    maxPeople: 8,
    isActive: true,
    imageUrl: "/images/restaurant/menu-anniversary.png?v=3",
  },
];

function parseJson<T>(v: unknown): T | null {
  if (typeof v !== "string" || !v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function overlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

function getDateOffsetDays(yyyymmdd: string): number {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = yyyymmdd.split("-").map((v) => Number(v));
  const target = new Date(y, m - 1, d);
  const diffMs = target.getTime() - current.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT value FROM ${SETTINGS_TABLE} WHERE key = ? LIMIT 1`,
    args: [key],
  });
  if (res.rows.length === 0) return fallback;
  const value = Number(res.rows[0].value);
  return Number.isFinite(value) ? value : fallback;
}

async function getStringSetting(key: string, fallback: string): Promise<string> {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT value FROM ${SETTINGS_TABLE} WHERE key = ? LIMIT 1`,
    args: [key],
  });
  if (res.rows.length === 0) return fallback;
  const value = String(res.rows[0].value ?? "").trim();
  return value || fallback;
}

export async function ensureRestaurantTables(): Promise<void> {
  const client = getTursoClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${MENU_TABLE} (
      id TEXT PRIMARY KEY,
      menu_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${RESERVATION_TABLE} (
      id TEXT PRIMARY KEY,
      reservation_number TEXT NOT NULL,
      reservation_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      status TEXT NOT NULL,
      reservation_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${NOTIFICATION_TABLE} (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      scheduled_at TEXT,
      sent_at TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_restaurant_reservation_date ON ${RESERVATION_TABLE}(reservation_date)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_restaurant_reservation_number ON ${RESERVATION_TABLE}(reservation_number)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_restaurant_notifications_reservation ON ${NOTIFICATION_TABLE}(reservation_id)`);

  const now = new Date().toISOString();
  for (const menu of DEFAULT_MENUS) {
    await client.execute({
      sql: `INSERT INTO ${MENU_TABLE} (id, menu_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET menu_json = excluded.menu_json, updated_at = excluded.updated_at`,
      args: [menu.id, JSON.stringify(menu), now, now],
    });
  }
  const defaultSettings: Array<[string, string]> = [
    ["open_time", "11:00"],
    ["close_time", "21:00"],
    ["total_seats", "20"],
    ["same_time_reservation_limit", "4"],
    ["reservation_window_days", "30"],
    ["same_day_cutoff_hours", "2"],
  ];
  for (const [key, value] of defaultSettings) {
    await client.execute({
      sql: `INSERT INTO ${SETTINGS_TABLE} (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO NOTHING`,
      args: [key, value, now],
    });
  }
}

async function logNotification(args: {
  reservationId: string;
  type: string;
  channel: string;
  status: "scheduled" | "sent" | "failed" | "cancelled";
  scheduledAt?: string;
  sentAt?: string;
  errorMessage?: string;
}) {
  const client = getTursoClient();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO ${NOTIFICATION_TABLE}
          (id, reservation_id, notification_type, channel, scheduled_at, sent_at, status, error_message, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      args.reservationId,
      args.type,
      args.channel,
      args.scheduledAt ?? null,
      args.sentAt ?? null,
      args.status,
      args.errorMessage ?? null,
      now,
      now,
    ],
  });
}

async function alreadySentNotification(reservationId: string, type: string): Promise<boolean> {
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT id FROM ${NOTIFICATION_TABLE}
          WHERE reservation_id = ? AND notification_type = ? AND status = 'sent'
          LIMIT 1`,
    args: [reservationId, type],
  });
  return res.rows.length > 0;
}

async function sendReservationEmail(args: {
  to: string;
  subject: string;
  lines: string[];
  reservationId: string;
  type: string;
}) {
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    await logNotification({
      reservationId: args.reservationId,
      type: args.type,
      channel: "email",
      status: "failed",
      errorMessage: "メール設定未構成",
    });
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: { user: emailConfig.user, pass: emailConfig.pass },
    });
    await transporter.sendMail({
      from: emailConfig.from,
      to: args.to,
      subject: args.subject,
      text: args.lines.join("\n"),
    });
    await logNotification({
      reservationId: args.reservationId,
      type: args.type,
      channel: "email",
      status: "sent",
      sentAt: new Date().toISOString(),
    });
  } catch {
    await logNotification({
      reservationId: args.reservationId,
      type: args.type,
      channel: "email",
      status: "failed",
      errorMessage: "送信失敗",
    });
  }
}

export async function getRestaurantMenus(): Promise<RestaurantMenu[]> {
  await ensureRestaurantTables();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT menu_json FROM ${MENU_TABLE} ORDER BY id ASC`,
    args: [],
  });
  return res.rows
    .map((r) => parseJson<RestaurantMenu>(r.menu_json))
    .filter((m): m is RestaurantMenu => !!m)
    .filter((m) => m.isActive);
}

export async function getReservationsByDate(date: string): Promise<RestaurantReservation[]> {
  await ensureRestaurantTables();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT reservation_json FROM ${RESERVATION_TABLE} WHERE reservation_date = ? ORDER BY start_time ASC`,
    args: [date],
  });
  return res.rows
    .map((r) => parseJson<RestaurantReservation>(r.reservation_json))
    .filter((v): v is RestaurantReservation => !!v);
}

export async function listReservations(params?: {
  date?: string;
  status?: string;
}): Promise<RestaurantReservation[]> {
  await ensureRestaurantTables();
  const client = getTursoClient();
  const date = (params?.date ?? "").trim();
  if (date) {
    const all = await getReservationsByDate(date);
    if (!params?.status) return all;
    return all.filter((r) => r.status === params.status);
  }
  const res = await client.execute({
    sql: `SELECT reservation_json FROM ${RESERVATION_TABLE} ORDER BY reservation_date DESC, start_time ASC`,
    args: [],
  });
  const all = res.rows
    .map((r) => parseJson<RestaurantReservation>(r.reservation_json))
    .filter((v): v is RestaurantReservation => !!v);
  if (!params?.status) return all;
  return all.filter((r) => r.status === params.status);
}

export async function calculateAvailability(args: {
  date: string;
  menuId: string;
  peopleCount: number;
}): Promise<{ slots: AvailabilitySlot[]; reason?: string }> {
  await ensureRestaurantTables();
  const date = args.date.trim();
  const peopleCount = args.peopleCount;
  if (!date) return { slots: [], reason: "日付が必要です。" };
  if (!Number.isFinite(peopleCount) || peopleCount <= 0) return { slots: [], reason: "人数が不正です。" };

  const windowDays = await getNumberSetting("reservation_window_days", 30);
  const offset = getDateOffsetDays(date);
  if (offset < 0 || offset > windowDays) {
    return { slots: [], reason: `予約可能期間外です（当日〜${windowDays}日先）` };
  }

  const menus = await getRestaurantMenus();
  const menu = menus.find((m) => m.id === args.menuId);
  if (!menu) return { slots: [], reason: "メニューが見つかりません。" };
  if (peopleCount < menu.minPeople || peopleCount > menu.maxPeople) {
    return { slots: [], reason: `このメニューは${menu.minPeople}〜${menu.maxPeople}名です。` };
  }

  const openText = await getStringSetting("open_time", "11:00");
  const closeText = await getStringSetting("close_time", "21:00");
  const openMin = toMinutes(openText);
  const closeMin = toMinutes(closeText);
  const totalSeats = await getNumberSetting("total_seats", 20);
  const sameTimeLimit = await getNumberSetting("same_time_reservation_limit", 4);
  const sameDayCutoffHours = await getNumberSetting("same_day_cutoff_hours", 2);

  const dayReservations = await getReservationsByDate(date);
  const active = dayReservations.filter((r) => ACTIVE_STATUSES.has(r.status));

  const now = new Date();
  const slots: AvailabilitySlot[] = [];
  for (let start = openMin; start + menu.durationMinutes <= closeMin; start += SLOT_MINUTES) {
    const end = start + menu.durationMinutes;
    const slotStartHHMM = toHHMM(start);
    const slotEndHHMM = toHHMM(end);

    if (offset === 0) {
      const slotDate = new Date(`${date}T${slotStartHHMM}:00`);
      const diffHours = (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (diffHours < sameDayCutoffHours) continue;
    }

    let concurrentPeople = 0;
    let concurrentGroups = 0;
    for (const r of active) {
      const rs = toMinutes(r.startTime);
      const re = toMinutes(r.endTime);
      if (overlap(start, end, rs, re)) {
        concurrentPeople += r.peopleCount;
        concurrentGroups += 1;
      }
    }
    if (concurrentPeople + peopleCount > totalSeats) continue;
    if (concurrentGroups >= sameTimeLimit) continue;

    slots.push({
      startTime: slotStartHHMM,
      endTime: slotEndHHMM,
      remainingSeats: Math.max(0, totalSeats - (concurrentPeople + peopleCount)),
    });
  }

  return { slots };
}

export async function createReservation(input: {
  menuId: string;
  date: string;
  startTime: string;
  peopleCount: number;
  customerName: string;
  phone: string;
  email: string;
  note?: string;
}): Promise<{ reservation?: RestaurantReservation; error?: string }> {
  await ensureRestaurantTables();
  const menus = await getRestaurantMenus();
  const menu = menus.find((m) => m.id === input.menuId);
  if (!menu) return { error: "メニューが見つかりません。" };
  const available = await calculateAvailability({
    date: input.date,
    menuId: input.menuId,
    peopleCount: input.peopleCount,
  });
  if (available.reason) return { error: available.reason };
  const slot = available.slots.find((s) => s.startTime === input.startTime);
  if (!slot) return { error: "選択した時間は予約できません。" };

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const reservationNumber = `RSV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(0, 6).toUpperCase()}`;
  const reservation: RestaurantReservation = {
    id,
    reservationNumber,
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    reservationDate: input.date,
    startTime: input.startTime,
    endTime: slot.endTime,
    peopleCount: input.peopleCount,
    menuId: menu.id,
    menuName: menu.name,
    note: (input.note ?? "").trim() || undefined,
    status: "confirmed",
    createdAt: now,
    updatedAt: now,
  };
  const client = getTursoClient();
  await client.execute({
    sql: `INSERT INTO ${RESERVATION_TABLE} (id, reservation_number, reservation_date, start_time, status, reservation_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      reservation.id,
      reservation.reservationNumber,
      reservation.reservationDate,
      reservation.startTime,
      reservation.status,
      JSON.stringify(reservation),
      now,
      now,
    ],
  });
  void sendReservationEmail({
    to: reservation.email,
    reservationId: reservation.id,
    type: "reservation_created",
    subject: `【予約確定】${reservation.reservationNumber}`,
    lines: [
      "ご予約ありがとうございます。以下の内容で予約を承りました。",
      "",
      `予約番号: ${reservation.reservationNumber}`,
      `メニュー: ${reservation.menuName}`,
      `日付: ${reservation.reservationDate}`,
      `時間: ${reservation.startTime} - ${reservation.endTime}`,
      `人数: ${reservation.peopleCount}名`,
    ],
  });
  return { reservation };
}

export async function cancelReservation(input: {
  reservationNumber: string;
  email: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string; reservation?: RestaurantReservation }> {
  await ensureRestaurantTables();
  const reservationNumber = input.reservationNumber.trim();
  const email = input.email.trim().toLowerCase();
  if (!reservationNumber || !email) return { ok: false, error: "予約番号とメールアドレスは必須です。" };
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT id, reservation_json FROM ${RESERVATION_TABLE} WHERE reservation_number = ? LIMIT 1`,
    args: [reservationNumber],
  });
  if (res.rows.length === 0) return { ok: false, error: "予約が見つかりません。" };
  const record = parseJson<RestaurantReservation>(res.rows[0].reservation_json);
  if (!record) return { ok: false, error: "予約データが壊れています。" };
  if (record.email.toLowerCase() !== email) return { ok: false, error: "メールアドレスが一致しません。" };
  if (record.status === "cancelled") return { ok: true, reservation: record };

  const now = new Date().toISOString();
  const next: RestaurantReservation = {
    ...record,
    status: "cancelled",
    updatedAt: now,
    cancelledAt: now,
    note: [record.note, input.reason?.trim()].filter(Boolean).join(" / ") || undefined,
  };
  await client.execute({
    sql: `UPDATE ${RESERVATION_TABLE}
          SET status = ?, reservation_json = ?, updated_at = ?
          WHERE id = ?`,
    args: [next.status, JSON.stringify(next), now, record.id],
  });
  void sendReservationEmail({
    to: next.email,
    reservationId: next.id,
    type: "cancellation_notice",
    subject: `【予約キャンセル】${next.reservationNumber}`,
    lines: [
      "ご予約のキャンセルを受け付けました。",
      "",
      `予約番号: ${next.reservationNumber}`,
      `メニュー: ${next.menuName}`,
      `日付: ${next.reservationDate}`,
      `時間: ${next.startTime} - ${next.endTime}`,
    ],
  });
  return { ok: true, reservation: next };
}

export async function runReminderNotifications(now: Date = new Date()): Promise<{
  sent: number;
  targets: number;
}> {
  await ensureRestaurantTables();
  const all = await listReservations();
  const active = all.filter((r) => ACTIVE_STATUSES.has(r.status));
  let sent = 0;
  let targets = 0;
  const current = new Date(now);
  for (const r of active) {
    const start = new Date(`${r.reservationDate}T${r.startTime}:00`);
    const diffMs = start.getTime() - current.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    let type: string | null = null;
    if (diffDays > 2.8 && diffDays < 3.2) type = "reminder_3days";
    else if (diffHours > 23 && diffHours < 26) type = "reminder_1day";
    else if (diffHours > 8 && diffHours < 10.5) type = "reminder_same_day";
    if (!type) continue;
    if (await alreadySentNotification(r.id, type)) continue;
    targets += 1;
    await sendReservationEmail({
      to: r.email,
      reservationId: r.id,
      type,
      subject: `【予約リマインド】${r.reservationNumber}`,
      lines: [
        "ご予約日のご案内です。",
        "",
        `予約番号: ${r.reservationNumber}`,
        `メニュー: ${r.menuName}`,
        `日付: ${r.reservationDate}`,
        `時間: ${r.startTime} - ${r.endTime}`,
        `人数: ${r.peopleCount}名`,
      ],
    });
    sent += 1;
  }
  return { sent, targets };
}

export async function updateReservationStatus(input: {
  id: string;
  status: ReservationStatus;
}): Promise<{ ok: boolean; reservation?: RestaurantReservation; error?: string }> {
  await ensureRestaurantTables();
  const id = input.id.trim();
  if (!id) return { ok: false, error: "id が必要です。" };
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT reservation_json FROM ${RESERVATION_TABLE} WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (res.rows.length === 0) return { ok: false, error: "予約が見つかりません。" };
  const current = parseJson<RestaurantReservation>(res.rows[0].reservation_json);
  if (!current) return { ok: false, error: "予約データが壊れています。" };
  const now = new Date().toISOString();
  const next: RestaurantReservation = {
    ...current,
    status: input.status,
    updatedAt: now,
    visitedAt: input.status === "visited" ? now : current.visitedAt,
  };
  await client.execute({
    sql: `UPDATE ${RESERVATION_TABLE}
          SET status = ?, reservation_json = ?, updated_at = ?
          WHERE id = ?`,
    args: [next.status, JSON.stringify(next), now, id],
  });
  return { ok: true, reservation: next };
}

export async function listNotifications(limit: number = 200): Promise<RestaurantNotification[]> {
  await ensureRestaurantTables();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT id, reservation_id, notification_type, channel, scheduled_at, sent_at, status, error_message, created_at, updated_at
          FROM ${NOTIFICATION_TABLE}
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [Math.max(1, Math.min(limit, 1000))],
  });
  return res.rows.map((row) => ({
    id: String(row.id),
    reservationId: String(row.reservation_id),
    notificationType: String(row.notification_type),
    channel: String(row.channel),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    status: String(row.status) as RestaurantNotification["status"],
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}
