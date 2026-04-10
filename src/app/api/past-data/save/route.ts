/**
 * 過去データ保存（案件登録時に依頼元・お客様を登録）
 */
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

function trim(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s).trim();
}

type SaveBody = {
  reception_no?: string | null;
  shop_name?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  /** true のときは受付番号重複時も上書き保存（INSERT OR REPLACE 相当） */
  overwrite?: boolean | null;
};

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  try {
    const body = (await request.json().catch(() => ({}))) as SaveBody;
    const reception_no = trim(body.reception_no);
    const shop_name = trim(body.shop_name);
    const shop_phone = trim(body.shop_phone);
    const shop_address = trim(body.shop_address);
    const customer_name = trim(body.customer_name);
    const customer_phone = trim(body.customer_phone);
    const customer_address = trim(body.customer_address);
    const overwrite = body.overwrite === true;

    if (!reception_no && !shop_name && !shop_phone && !customer_name && !customer_phone) {
      return NextResponse.json({ ok: true, message: "保存対象なし" });
    }

    const client = getTursoClient();
    const now = new Date().toISOString();

    let requester_id: string;
    let customer_id: string;

    if (shop_name || shop_phone) {
      const existingReq = await client.execute({
        sql: "SELECT id FROM requester_info WHERE shop_name = ? AND shop_phone = ? LIMIT 1",
        args: [shop_name || "", shop_phone || ""],
      });
      if (existingReq.rows.length > 0) {
        requester_id = String((existingReq.rows[0] as unknown as { id: string }).id);
        await client.execute({
          sql: "UPDATE requester_info SET shop_name = ?, shop_phone = ?, shop_address = ?, updated_at = ? WHERE id = ?",
          args: [shop_name || "", shop_phone || "", shop_address || "", now, requester_id],
        });
      } else {
        requester_id = uuidv4();
        await client.execute({
          sql: "INSERT INTO requester_info (id, shop_name, shop_phone, shop_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [requester_id, shop_name || "", shop_phone || "", shop_address || "", now, now],
        });
      }
    } else {
      requester_id = uuidv4();
      await client.execute({
        sql: "INSERT INTO requester_info (id, shop_name, shop_phone, shop_address, created_at, updated_at) VALUES (?, '', '', '', ?, ?)",
        args: [requester_id, now, now],
      });
    }

    if (customer_name || customer_phone) {
      const existingCust = await client.execute({
        sql: "SELECT id FROM customer_info WHERE customer_name = ? AND customer_phone = ? LIMIT 1",
        args: [customer_name || "", customer_phone || ""],
      });
      if (existingCust.rows.length > 0) {
        customer_id = String((existingCust.rows[0] as unknown as { id: string }).id);
        await client.execute({
          sql: "UPDATE customer_info SET customer_name = ?, customer_phone = ?, customer_address = ?, updated_at = ? WHERE id = ?",
          args: [customer_name || "", customer_phone || "", customer_address || "", now, customer_id],
        });
      } else {
        customer_id = uuidv4();
        await client.execute({
          sql: "INSERT INTO customer_info (id, customer_name, customer_phone, customer_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [customer_id, customer_name || "", customer_phone || "", customer_address || "", now, now],
        });
      }
    } else {
      customer_id = uuidv4();
      await client.execute({
        sql: "INSERT INTO customer_info (id, customer_name, customer_phone, customer_address, created_at, updated_at) VALUES (?, '', '', '', ?, ?)",
        args: [customer_id, now, now],
      });
    }

    if (reception_no) {
      if (overwrite) {
        const existing = await client.execute({
          sql: "SELECT id FROM case_lookup WHERE reception_no = ? LIMIT 1",
          args: [reception_no],
        });
        if (existing.rows.length > 0) {
          const row = existing.rows[0] as unknown as { id: string };
          await client.execute({
            sql: "UPDATE case_lookup SET requester_id = ?, customer_id = ?, updated_at = ? WHERE id = ?",
            args: [requester_id, customer_id, now, row.id],
          });
        } else {
          await client.execute({
            sql: "INSERT INTO case_lookup (id, reception_no, requester_id, customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            args: [uuidv4(), reception_no, requester_id, customer_id, now, now],
          });
        }
      } else {
        try {
          await client.execute({
            sql: "INSERT INTO case_lookup (id, reception_no, requester_id, customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            args: [uuidv4(), reception_no, requester_id, customer_id, now, now],
          });
        } catch (insertErr: unknown) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          const isUnique = /UNIQUE|unique|SQLITE_CONSTRAINT|2067/i.test(msg);
          if (isUnique) {
            return NextResponse.json({
              ok: false,
              error: "duplicate",
              message: "この受付番号はすでに登録されています",
              reception_no,
            });
          }
          throw insertErr;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/past-data/save] error", err);
    return NextResponse.json({ ok: false, error: "保存に失敗しました" }, { status: 500 });
  }
}
