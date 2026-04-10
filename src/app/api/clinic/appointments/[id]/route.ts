import { appointmentToPublic, updateClinicAppointmentStatus } from "@/lib/clinic-appointment";
import type { ClinicAppointmentStatus } from "@/lib/clinic-types";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED: Set<ClinicAppointmentStatus> = new Set([
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { status?: string };
    const status = String(body.status ?? "").trim() as ClinicAppointmentStatus;
    if (!id || !ALLOWED.has(status)) {
      return NextResponse.json({ ok: false, error: "id または status が不正です。" }, { status: 400 });
    }
    const result = await updateClinicAppointmentStatus(id, status);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, appointment: appointmentToPublic(result.appointment) });
  } catch (error) {
    console.error("[api/clinic/appointments/[id]] PATCH", error);
    return NextResponse.json({ ok: false, error: "更新に失敗しました。" }, { status: 500 });
  }
}
