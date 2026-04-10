import { NextRequest, NextResponse } from "next/server";
import { calculateAvailability } from "@/lib/restaurant-reservation";

export async function GET(request: NextRequest) {
  try {
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim();
    const menuId = (request.nextUrl.searchParams.get("menuId") ?? "").trim();
    const peopleCount = Number(request.nextUrl.searchParams.get("peopleCount") ?? "0");
    const result = await calculateAvailability({ date, menuId, peopleCount });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/restaurant/availability] GET", error);
    return NextResponse.json({ ok: false, error: "空き枠取得に失敗しました。" }, { status: 500 });
  }
}
