import { NextResponse } from "next/server";
import { runReminderNotifications } from "@/lib/restaurant-reservation";

export async function POST() {
  try {
    const result = await runReminderNotifications(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/restaurant/reminders/run] POST", error);
    return NextResponse.json({ ok: false, error: "リマインド実行に失敗しました。" }, { status: 500 });
  }
}
