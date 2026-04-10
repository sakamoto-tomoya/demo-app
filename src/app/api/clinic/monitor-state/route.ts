import { getMonitorState, updateMonitorAnnouncement } from "@/lib/clinic-queue";
import { NextRequest, NextResponse } from "next/server";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 待合モニター・患者向けに PII を含まない状態のみ返す */
export async function GET(request: NextRequest) {
  try {
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim() || todayYmd();
    const monitor = await getMonitorState(date);
    return NextResponse.json({
      ok: true,
      date: monitor.serviceDate,
      callingReceptionNo: monitor.callingReceptionNo,
      nextReceptionNo: monitor.nextReceptionNo,
      announcement: monitor.announcement,
      avgConsultMinutes: monitor.avgConsultMinutes,
      updatedAt: monitor.updatedAt,
    });
  } catch (error) {
    console.error("[api/clinic/monitor-state] GET", error);
    return NextResponse.json({ ok: false, error: "表示状態の取得に失敗しました。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      date?: string;
      announcement?: string;
      avgConsultMinutes?: number;
    };
    const date = (body.date ?? "").trim() || todayYmd();
    const result = await updateMonitorAnnouncement(
      date,
      String(body.announcement ?? ""),
      body.avgConsultMinutes
    );
    const m = result.monitor;
    return NextResponse.json({
      ok: true,
      date: m.serviceDate,
      callingReceptionNo: m.callingReceptionNo,
      nextReceptionNo: m.nextReceptionNo,
      announcement: m.announcement,
      avgConsultMinutes: m.avgConsultMinutes,
      updatedAt: m.updatedAt,
    });
  } catch (error) {
    console.error("[api/clinic/monitor-state] PATCH", error);
    return NextResponse.json({ ok: false, error: "更新に失敗しました。" }, { status: 500 });
  }
}
