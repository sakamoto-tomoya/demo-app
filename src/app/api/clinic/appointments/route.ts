import {
  appointmentToPublic,
  createClinicAppointment,
  listClinicAppointments,
} from "@/lib/clinic-appointment";
import type { ClinicOriginType } from "@/lib/clinic-types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const hospitalId = (request.nextUrl.searchParams.get("hospitalId") ?? "").trim();
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim();
    const rows = await listClinicAppointments({
      hospitalId: hospitalId || undefined,
      date: date || undefined,
    });
    return NextResponse.json({
      ok: true,
      appointments: rows.map(appointmentToPublic),
    });
  } catch (error) {
    console.error("[api/clinic/appointments] GET", error);
    return NextResponse.json({ ok: false, error: "一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      hospitalId?: string;
      appointmentDate?: string;
      startTime?: string;
      department?: string;
      patientName?: string;
      birthDate?: string;
      phone?: string;
      firstVisit?: boolean;
      symptomNote?: string;
      originType?: string;
      originText?: string;
      travelMinutes?: number;
      notifyPush?: boolean;
      notifyCall?: boolean;
      mynumberDemo?: {
        enabled?: boolean;
        familyHospitalId?: string;
        prescriptionIds?: string[];
        mynumberRegisteredPrefecture?: string;
      };
    };
    const originRaw = String(body.originType ?? "none").trim();
    const originType: ClinicOriginType =
      originRaw === "home" || originRaw === "current" ? originRaw : "none";
    const md = body.mynumberDemo;
    const result = await createClinicAppointment({
      hospitalId: String(body.hospitalId ?? "").trim(),
      appointmentDate: String(body.appointmentDate ?? "").trim(),
      startTime: String(body.startTime ?? "").trim(),
      department: String(body.department ?? ""),
      patientName: String(body.patientName ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phone: String(body.phone ?? ""),
      firstVisit: Boolean(body.firstVisit),
      symptomNote: String(body.symptomNote ?? ""),
      originType,
      originText: String(body.originText ?? ""),
      travelMinutes: Number(body.travelMinutes ?? 0),
      notifyPush: Boolean(body.notifyPush),
      notifyCall: Boolean(body.notifyCall),
      mynumberDemo:
        md && Boolean(md.enabled)
          ? {
              enabled: true,
              familyHospitalId: String(md.familyHospitalId ?? "").trim(),
              prescriptionIds: Array.isArray(md.prescriptionIds) ? md.prescriptionIds.map(String) : [],
              mynumberRegisteredPrefecture: String(md.mynumberRegisteredPrefecture ?? "ALL").trim() || "ALL",
            }
          : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    const token = result.appointment.sessionToken;
    return NextResponse.json({
      ok: true,
      appointment: appointmentToPublic(result.appointment),
      sessionToken: token,
    });
  } catch (error) {
    console.error("[api/clinic/appointments] POST", error);
    return NextResponse.json({ ok: false, error: "予約の登録に失敗しました。" }, { status: 500 });
  }
}
