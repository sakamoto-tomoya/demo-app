/**
 * 過去データ更新（「更新する」選択時）
 */
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";

function trim(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s).trim();
}

type UpdateBody = {
  requester_id: string;
  customer_id: string;
  shop_name?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
};

export async function PUT(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  try {
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const { requester_id, customer_id } = body;
    if (!requester_id || !customer_id) {
      return NextResponse.json({ ok: false, error: "requester_id と customer_id は必須です" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const client = getTursoClient();

    await client.execute({
      sql: "UPDATE requester_info SET shop_name = ?, shop_phone = ?, shop_address = ?, updated_at = ? WHERE id = ?",
      args: [trim(body.shop_name) || "", trim(body.shop_phone) || "", trim(body.shop_address) || "", now, requester_id],
    });
    await client.execute({
      sql: "UPDATE customer_info SET customer_name = ?, customer_phone = ?, customer_address = ?, updated_at = ? WHERE id = ?",
      args: [trim(body.customer_name) || "", trim(body.customer_phone) || "", trim(body.customer_address) || "", now, customer_id],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/past-data/update] error", err);
    return NextResponse.json({ ok: false, error: "更新に失敗しました" }, { status: 500 });
  }
}
