import { getPatientStatusPayload } from "@/lib/clinic-queue";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "token が必要です。" }, { status: 400 });
    }
    const payload = await getPatientStatusPayload(token);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "受付情報が見つかりません。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[api/clinic/receptions/me] GET", error);
    return NextResponse.json({ ok: false, error: "状態の取得に失敗しました。" }, { status: 500 });
  }
}
