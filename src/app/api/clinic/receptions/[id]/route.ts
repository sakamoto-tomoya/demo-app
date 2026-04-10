import { receptionToPublic, updateReceptionStatus } from "@/lib/clinic-queue";
import type { ClinicReceptionStatus } from "@/lib/clinic-types";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED: Set<ClinicReceptionStatus> = new Set([
  "provisional",
  "checked_in",
  "waiting",
  "calling",
  "in_consultation",
  "done",
  "absent",
  "cancelled",
]);

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { status?: string };
    const status = String(body.status ?? "").trim() as ClinicReceptionStatus;
    if (!id || !ALLOWED.has(status)) {
      return NextResponse.json({ ok: false, error: "id または status が不正です。" }, { status: 400 });
    }
    const result = await updateReceptionStatus(id, status);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, reception: receptionToPublic(result.reception) });
  } catch (error) {
    console.error("[api/clinic/receptions/[id]] PATCH", error);
    return NextResponse.json({ ok: false, error: "更新に失敗しました。" }, { status: 500 });
  }
}
