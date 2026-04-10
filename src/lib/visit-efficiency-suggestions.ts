import { parseISO } from "date-fns";
import type { CaseRecord } from "@/lib/types";
import type { VisitEfficiencyAccess } from "@/lib/visit-efficiency-access";
import { normalizeAssigneeName } from "@/lib/visit-efficiency-access";

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatVisitTimeRange(rec: Pick<CaseRecord, "visitTimeMorningContact" | "visitTimeStart" | "visitTimeEnd">): string {
  if (rec.visitTimeMorningContact) return "当日朝連絡";
  const s = (rec.visitTimeStart ?? "").trim();
  const e = (rec.visitTimeEnd ?? "").trim();
  if (s && e) return `${s}〜${e}`;
  if (s) return s;
  if (e) return e;
  return "時間未設定";
}

function formatDateJaShort(isoLike: string | null | undefined): string {
  const raw = (isoLike ?? "").trim();
  if (!raw) return "日付未設定";
  try {
    const d = parseISO(raw);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return raw;
  }
}

function parseHmToMinutes(hm: string): number | null {
  const m = (hm ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function minutesToHm(total: number): string {
  const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalized / 60)).padStart(2, "0");
  const m = String(normalized % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildAppointmentSuggestion(
  visitDate: string | null | undefined,
  visitTimeStart: string | null | undefined,
  visitTimeEnd: string | null | undefined
): { before: string; after: string } {
  const dateText = formatDateJaShort(visitDate);
  const startMin = parseHmToMinutes((visitTimeStart ?? "").trim());
  const endMin = parseHmToMinutes((visitTimeEnd ?? "").trim());
  if (startMin == null || endMin == null || endMin <= startMin) {
    return {
      before: `${dateText} 09:00〜11:00 頃`,
      after: `${dateText} 17:00〜19:00 頃`,
    };
  }
  return {
    before: `${dateText} ${minutesToHm(startMin - 120)}〜${minutesToHm(startMin)} 頃`,
    after: `${dateText} ${minutesToHm(endMin)}〜${minutesToHm(endMin + 120)} 頃`,
  };
}

export type VisitEfficiencySuggestionItem = {
  id: string;
  dateTimeText: string;
  assignee: string;
  customer: string;
  model: string;
  distanceKm: number;
  appointmentBefore: string;
  appointmentAfter: string;
};

export function buildVisitEfficiencySuggestions(
  cases: CaseRecord[],
  opts: {
    baseLat: number;
    baseLng: number;
    excludeCaseId: string;
    access: VisitEfficiencyAccess;
  }
): VisitEfficiencySuggestionItem[] {
  const { baseLat, baseLng, excludeCaseId, access } = opts;
  if (access.kind === "hidden") return [];

  const selfKey =
    access.kind === "self" ? normalizeAssigneeName(access.viewerName) : null;

  let filtered = cases.filter((c) => c.id !== excludeCaseId);
  filtered = filtered.filter((c) => c.status !== "completed" && c.status !== "cancelled");
  filtered = filtered.filter((c) => c.lat != null && c.lng != null);

  if (access.kind === "self" && selfKey) {
    filtered = filtered.filter((c) => normalizeAssigneeName(c.assignedTo) === selfKey);
  }

  const withKm = filtered
    .map((c) => {
      const distanceKm = haversineKm(baseLat, baseLng, Number(c.lat), Number(c.lng));
      return { c, distanceKm };
    })
    .filter((x) => Number.isFinite(x.distanceKm))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return withKm.map(({ c, distanceKm }) => {
    const ap = buildAppointmentSuggestion(c.visitDate, c.visitTimeStart, c.visitTimeEnd);
    return {
      id: c.id,
      dateTimeText: `${(c.visitDate ?? "").trim() || "日付未設定"} ${formatVisitTimeRange(c)}`,
      assignee: (c.assignedTo ?? "").trim() || "未割当",
      customer: (c.customerName ?? "お客様").trim(),
      model: (c.modelName ?? c.reportedModelName ?? "未入力").trim(),
      distanceKm,
      appointmentBefore: ap.before,
      appointmentAfter: ap.after,
    };
  });
}
