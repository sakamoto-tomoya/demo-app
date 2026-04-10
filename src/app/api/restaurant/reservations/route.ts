import { NextRequest, NextResponse } from "next/server";
import { createReservation, listReservations, updateReservationStatus } from "@/lib/restaurant-reservation";

export async function GET(request: NextRequest) {
  try {
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim();
    const status = (request.nextUrl.searchParams.get("status") ?? "").trim();
    const reservations = await listReservations({ date, status: status || undefined });
    return NextResponse.json({ ok: true, reservations });
  } catch (error) {
    console.error("[api/restaurant/reservations] GET", error);
    return NextResponse.json({ ok: false, error: "予約一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      menuId?: string;
      date?: string;
      startTime?: string;
      peopleCount?: number;
      customerName?: string;
      phone?: string;
      email?: string;
      note?: string;
    };
    const result = await createReservation({
      menuId: String(body.menuId ?? "").trim(),
      date: String(body.date ?? "").trim(),
      startTime: String(body.startTime ?? "").trim(),
      peopleCount: Number(body.peopleCount ?? 0),
      customerName: String(body.customerName ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      email: String(body.email ?? "").trim(),
      note: String(body.note ?? "").trim(),
    });
    if (!result.reservation) {
      return NextResponse.json({ ok: false, error: result.error ?? "予約作成に失敗しました。" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, reservation: result.reservation });
  } catch (error) {
    console.error("[api/restaurant/reservations] POST", error);
    return NextResponse.json({ ok: false, error: "予約作成に失敗しました。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; status?: string };
    const allowed = new Set(["pending", "confirmed", "cancelled", "visited", "no_show"]);
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();
    if (!id || !allowed.has(status)) {
      return NextResponse.json({ ok: false, error: "id または status が不正です。" }, { status: 400 });
    }
    const result = await updateReservationStatus({ id, status: status as any });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "更新に失敗しました。" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, reservation: result.reservation });
  } catch (error) {
    console.error("[api/restaurant/reservations] PATCH", error);
    return NextResponse.json({ ok: false, error: "予約更新に失敗しました。" }, { status: 500 });
  }
}
