import { DEMO_FAMILY_HOSPITALS } from "@/lib/clinic-mynumber-demo";

/** 1枠の長さ（分）— 全病院共通デモ */
export const CLINIC_SLOT_MINUTES = 30;

/** 平日診療の枠（デモ）。weekdayMask = JSの getDay()（0=日〜6=土） */
export type ClinicHospitalDayTemplate = {
  weekdayOpen: number[];
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
};

const DEFAULT_TEMPLATE: ClinicHospitalDayTemplate = {
  weekdayOpen: [1, 2, 3, 4, 5, 6],
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "14:00", end: "18:00" },
};

export function isKnownClinicHospitalId(id: string): boolean {
  return DEMO_FAMILY_HOSPITALS.some((h) => h.id === id);
}

export function getClinicHospitalTemplate(_hospitalId: string): ClinicHospitalDayTemplate {
  return DEFAULT_TEMPLATE;
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

/** その日は診療日か（デモ・祝日は未考慮） */
export function isClinicOpenOnDate(hospitalId: string, ymd: string): boolean {
  if (!isKnownClinicHospitalId(hospitalId)) return false;
  const dt = parseYmdLocal(ymd);
  if (!dt || Number.isNaN(dt.getTime())) return false;
  const wd = dt.getDay();
  return getClinicHospitalTemplate(hospitalId).weekdayOpen.includes(wd);
}

function toMinutes(hhmm: string): number {
  const [h, mi] = hhmm.split(":").map((x) => Number(x));
  return h * 60 + mi;
}

function toHHMM(total: number): string {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function slotsInWindow(startHHMM: string, endHHMM: string, slotMinutes: number): string[] {
  const out: string[] = [];
  let cur = toMinutes(startHHMM);
  const end = toMinutes(endHHMM);
  while (cur + slotMinutes <= end) {
    out.push(toHHMM(cur));
    cur += slotMinutes;
  }
  return out;
}

/** 病院・日付に対する予約可能な開始時刻一覧（予約済みは除く前の理論枠） */
export function generateClinicSlotStarts(hospitalId: string, ymd: string): string[] {
  if (!isClinicOpenOnDate(hospitalId, ymd)) return [];
  const t = getClinicHospitalTemplate(hospitalId);
  const slot = CLINIC_SLOT_MINUTES;
  return [
    ...slotsInWindow(t.morning.start, t.morning.end, slot),
    ...slotsInWindow(t.afternoon.start, t.afternoon.end, slot),
  ];
}

export function clinicAppointmentWindowDays(): number {
  return 60;
}
