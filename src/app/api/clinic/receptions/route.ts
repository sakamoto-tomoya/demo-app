import { createReception, listReceptionsForAdmin, receptionToPublic } from "@/lib/clinic-queue";
import type { ClinicOriginType } from "@/lib/clinic-types";
import { NextRequest, NextResponse } from "next/server";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function GET(request: NextRequest) {
  try {
    const date = (request.nextUrl.searchParams.get("date") ?? "").trim() || todayYmd();
    const rows = await listReceptionsForAdmin(date);
    return NextResponse.json({ ok: true, date, receptions: rows });
  } catch (error) {
    console.error("[api/clinic/receptions] GET", error);
    return NextResponse.json({ ok: false, error: "一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      serviceDate?: string;
      department?: string;
      patientName?: string;
      birthDate?: string;
      phone?: string;
      firstVisit?: boolean;
      symptomNote?: string;
      originType?: string;
      originText?: string;
      travelMinutes?: number;
      notifyPush?: boolean;
      notifyCall?: boolean;
      mynumberDemo?: {
        enabled?: boolean;
        familyHospitalId?: string;
        prescriptionIds?: string[];
        mynumberRegisteredPrefecture?: string;
      };
    };
    const serviceDate = (body.serviceDate ?? "").trim() || todayYmd();
    const originRaw = String(body.originType ?? "none").trim();
    const originType: ClinicOriginType =
      originRaw === "home" || originRaw === "current" ? originRaw : "none";
    const md = body.mynumberDemo;
    const result = await createReception({
      serviceDate,
      department: String(body.department ?? ""),
      patientName: String(body.patientName ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phone: String(body.phone ?? ""),
      firstVisit: Boolean(body.firstVisit),
      symptomNote: String(body.symptomNote ?? ""),
      originType,
      originText: String(body.originText ?? ""),
      travelMinutes: Number(body.travelMinutes ?? 0),
      notifyPush: Boolean(body.notifyPush),
      notifyCall: Boolean(body.notifyCall),
      mynumberDemo:
        md && Boolean(md.enabled)
          ? {
              enabled: true,
              familyHospitalId: String(md.familyHospitalId ?? "").trim(),
              prescriptionIds: Array.isArray(md.prescriptionIds) ? md.prescriptionIds.map(String) : [],
              mynumberRegisteredPrefecture: String(md.mynumberRegisteredPrefecture ?? "ALL").trim() || "ALL",
            }
          : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    const sessionToken = result.reception.sessionToken;
    return NextResponse.json({
      ok: true,
      reception: receptionToPublic(result.reception),
      sessionToken,
    });
  } catch (error) {
    console.error("[api/clinic/receptions] POST", error);
    return NextResponse.json({ ok: false, error: "受付登録に失敗しました。" }, { status: 500 });
  }
}
