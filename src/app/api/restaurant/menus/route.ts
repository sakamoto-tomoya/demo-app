import { NextResponse } from "next/server";
import { getRestaurantMenus } from "@/lib/restaurant-reservation";

export async function GET() {
  try {
    const menus = await getRestaurantMenus();
    return NextResponse.json({ ok: true, menus });
  } catch (error) {
    console.error("[api/restaurant/menus] GET", error);
    return NextResponse.json({ ok: false, error: "メニュー取得に失敗しました。" }, { status: 500 });
  }
}
