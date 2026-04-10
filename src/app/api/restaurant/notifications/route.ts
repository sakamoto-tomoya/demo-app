import { NextRequest, NextResponse } from "next/server";
import { listNotifications } from "@/lib/restaurant-reservation";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const notifications = await listNotifications(limit);
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    console.error("[api/restaurant/notifications] GET", error);
    return NextResponse.json({ ok: false, error: "通知履歴の取得に失敗しました。" }, { status: 500 });
  }
}
