import { callReception } from "@/lib/clinic-queue";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id が必要です。" }, { status: 400 });
    }
    const result = await callReception(id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, monitor: result.monitor });
  } catch (error) {
    console.error("[api/clinic/call] POST", error);
    return NextResponse.json({ ok: false, error: "呼び出しに失敗しました。" }, { status: 500 });
  }
}
