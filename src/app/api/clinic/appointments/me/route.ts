import { getClinicAppointmentByToken, getClinicAppointmentPatientPayload } from "@/lib/clinic-appointment";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "token が必要です。" }, { status: 400 });
    }
    const row = await getClinicAppointmentByToken(token);
    if (!row) {
      return NextResponse.json({ ok: false, error: "予約が見つかりません。" }, { status: 404 });
    }
    const payload = getClinicAppointmentPatientPayload(row);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[api/clinic/appointments/me] GET", error);
    return NextResponse.json({ ok: false, error: "取得に失敗しました。" }, { status: 500 });
  }
}
