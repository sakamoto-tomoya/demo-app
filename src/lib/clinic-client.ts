"use client";

import type {
  ClinicAppointmentPublic,
  ClinicAppointmentStatus,
  ClinicMynumberDemoSummary,
} from "@/lib/clinic-types";

export type { ClinicAppointmentPublic, ClinicAppointmentStatus };

export function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function fetchClinicAvailability(
  hospitalId: string,
  date: string
): Promise<{ ok: boolean; slots?: string[]; error?: string }> {
  const sp = new URLSearchParams({ hospitalId, date });
  const res = await fetch(`/api/clinic/availability?${sp}`, { cache: "no-store" });
  const data = (await res.json()) as { ok?: boolean; slots?: string[]; error?: string };
  return { ok: !!data.ok, slots: data.slots, error: data.error };
}

export async function createClinicAppointment(body: {
  hospitalId: string;
  appointmentDate: string;
  startTime: string;
  department: string;
  patientName: string;
  birthDate: string;
  phone: string;
  firstVisit: boolean;
  symptomNote: string;
  originType: string;
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
}): Promise<{
  ok: boolean;
  sessionToken?: string;
  appointment?: ClinicAppointmentPublic;
  error?: string;
}> {
  const res = await fetch("/api/clinic/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    sessionToken?: string;
    appointment?: ClinicAppointmentPublic;
    error?: string;
  };
  return {
    ok: !!data.ok,
    sessionToken: data.sessionToken,
    appointment: data.appointment,
    error: data.error,
  };
}

export async function fetchClinicAppointments(params: {
  hospitalId?: string;
  date?: string;
}): Promise<{ ok: boolean; appointments?: ClinicAppointmentPublic[]; error?: string }> {
  const sp = new URLSearchParams();
  if (params.hospitalId) sp.set("hospitalId", params.hospitalId);
  if (params.date) sp.set("date", params.date);
  const qs = sp.toString();
  const res = await fetch(`/api/clinic/appointments${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  const data = (await res.json()) as {
    ok?: boolean;
    appointments?: ClinicAppointmentPublic[];
    error?: string;
  };
  return { ok: !!data.ok, appointments: data.appointments, error: data.error };
}

export async function patchClinicAppointmentStatus(
  id: string,
  status: ClinicAppointmentStatus
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/clinic/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: !!data.ok, error: data.error };
}

export type ClinicAppointmentMonitorJson = {
  hospitalId: string;
  hospitalName: string;
  date: string;
  bookedStartTimes: string[];
};

export async function fetchClinicAppointmentMonitor(params: {
  hospitalId?: string;
  date?: string;
}): Promise<{ ok: boolean; data?: ClinicAppointmentMonitorJson; error?: string }> {
  const sp = new URLSearchParams();
  if (params.hospitalId) sp.set("hospitalId", params.hospitalId);
  if (params.date) sp.set("date", params.date);
  const qs = sp.toString();
  const res = await fetch(`/api/clinic/appointments/monitor${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  const j = (await res.json()) as {
    ok?: boolean;
    hospitalId?: string;
    hospitalName?: string;
    date?: string;
    bookedStartTimes?: string[];
    error?: string;
  };
  if (!j.ok) return { ok: false, error: j.error };
  return {
    ok: true,
    data: {
      hospitalId: String(j.hospitalId ?? ""),
      hospitalName: String(j.hospitalName ?? ""),
      date: String(j.date ?? ""),
      bookedStartTimes: Array.isArray(j.bookedStartTimes) ? j.bookedStartTimes : [],
    },
  };
}

export type PatientMeResponse = {
  ok: boolean;
  hospitalId?: string;
  hospitalName?: string;
  appointmentDate?: string;
  startTime?: string;
  durationMinutes?: number;
  department?: string;
  status?: ClinicAppointmentStatus;
  travelMinutes?: number;
  departureHint?: string;
  notifyPush?: boolean;
  notifyCall?: boolean;
  mynumberDemo?: ClinicMynumberDemoSummary | null;
  error?: string;
};

export async function fetchClinicPatientMe(token: string): Promise<PatientMeResponse> {
  const res = await fetch(`/api/clinic/appointments/me?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  return (await res.json()) as PatientMeResponse;
}
