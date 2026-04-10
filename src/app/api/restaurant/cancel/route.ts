import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/lib/restaurant-reservation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      reservationNumber?: string;
      email?: string;
      reason?: string;
    };
    const result = await cancelReservation({
      reservationNumber: String(body.reservationNumber ?? "").trim(),
      email: String(body.email ?? "").trim(),
      reason: String(body.reason ?? "").trim(),
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "キャンセルに失敗しました。" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, reservation: result.reservation });
  } catch (error) {
    console.error("[api/restaurant/cancel] POST", error);
    return NextResponse.json({ ok: false, error: "キャンセルに失敗しました。" }, { status: 500 });
  }
}
