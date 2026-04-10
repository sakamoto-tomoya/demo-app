import { listBookedStartTimes } from "@/lib/clinic-appointment";
import { DEMO_FAMILY_HOSPITALS } from "@/lib/clinic-mynumber-demo";
import { NextRequest, NextResponse } from "next/server";

function todayYmdTokyo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 待合モニター用：氏名なし・予約開始時刻のみ */
export async function GET(request: NextRequest) {
  try {
    const hospitalId =
      (request.nextUrl.searchParams.get("hospitalId") ?? "").trim() || DEMO_FAMILY_HOSPITALS[0]?.id;
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim() || todayYmdTokyo();
    if (!hospitalId) {
      return NextResponse.json({ ok: false, error: "hospitalId が必要です。" }, { status: 400 });
    }
    const booked = await listBookedStartTimes(hospitalId, date);
    const times = [...booked].sort();
    const name = DEMO_FAMILY_HOSPITALS.find((h) => h.id === hospitalId)?.name ?? "";
    return NextResponse.json({
      ok: true,
      hospitalId,
      hospitalName: name,
      date,
      bookedStartTimes: times,
    });
  } catch (error) {
    console.error("[api/clinic/appointments/monitor] GET", error);
    return NextResponse.json({ ok: false, error: "取得に失敗しました。" }, { status: 500 });
  }
}
