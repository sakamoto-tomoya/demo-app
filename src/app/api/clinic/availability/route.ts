import { getClinicAvailability } from "@/lib/clinic-appointment";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const hospitalId = (request.nextUrl.searchParams.get("hospitalId") ?? "").trim();
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim();
    if (!hospitalId || !date) {
      return NextResponse.json({ ok: false, error: "hospitalId と date が必要です。" }, { status: 400 });
    }
    const slots = await getClinicAvailability(hospitalId, date);
    return NextResponse.json({ ok: true, hospitalId, date, slots });
  } catch (error) {
    console.error("[api/clinic/availability] GET", error);
    return NextResponse.json({ ok: false, error: "空き枠の取得に失敗しました。" }, { status: 500 });
  }
}
