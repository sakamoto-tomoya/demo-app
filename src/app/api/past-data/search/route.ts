/**
 * 過去データ検索（OCR後の自動反映用）
 * POST: 修理受付番号 / 依頼元 / お客様 で検索し、マージ結果を返す
 */
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";

function trim(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s).trim();
}

type SearchBody = {
  reception_no?: string | null;
  shop_name?: string | null;
  shop_phone?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address?: string | null;
};

export type PastDataSearchResult = {
  matched: boolean;
  matchType: "reception_no" | "requester" | "customer_phone" | "customer_address" | "partial";
  requester?: {
    id: string;
    shop_name: string;
    shop_phone: string;
    shop_address: string;
    updated_at: string;
  };
  customer?: {
    id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    updated_at: string;
  };
  /** 反映した項目名（表示用） */
  filledFields: string[];
};

const FIELD_LABELS: Record<string, string> = {
  shop_name: "ご依頼店名",
  shop_phone: "依頼元電話番号",
  shop_address: "依頼元住所",
  customer_name: "お客様名",
  customer_phone: "お客様電話番号",
  customer_address: "お客様住所",
};

export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  try {
    const body = (await request.json().catch(() => ({}))) as SearchBody;
    const reception_no = trim(body.reception_no);
    const shop_name = trim(body.shop_name);
    const shop_phone = trim(body.shop_phone);
    const customer_name = trim(body.customer_name);
    const customer_phone = trim(body.customer_phone);
    const address = trim(body.address);

    const client = getTursoClient();
    let requester: PastDataSearchResult["requester"] | undefined;
    let customer: PastDataSearchResult["customer"] | undefined;
    let matchType: PastDataSearchResult["matchType"] = "partial";
    const filledFields: string[] = [];

    // 1. 修理受付番号で検索 → case_lookup → requester + customer
    if (reception_no) {
      const caseRow = await client.execute({
        sql: "SELECT id, reception_no, requester_id, customer_id FROM case_lookup WHERE reception_no = ? LIMIT 1",
        args: [reception_no],
      });
      if (caseRow.rows.length > 0) {
        const row = caseRow.rows[0] as unknown as { requester_id: string; customer_id: string };
        const [reqRes, custRes] = await Promise.all([
          client.execute({
            sql: "SELECT id, shop_name, shop_phone, shop_address, updated_at FROM requester_info WHERE id = ?",
            args: [row.requester_id],
          }),
          client.execute({
            sql: "SELECT id, customer_name, customer_phone, customer_address, updated_at FROM customer_info WHERE id = ?",
            args: [row.customer_id],
          }),
        ]);
        if (reqRes.rows.length > 0) {
          const r = reqRes.rows[0] as unknown as { id: string; shop_name: string; shop_phone: string; shop_address: string; updated_at: string };
          requester = { id: r.id, shop_name: r.shop_name, shop_phone: r.shop_phone, shop_address: r.shop_address ?? "", updated_at: r.updated_at };
          filledFields.push(FIELD_LABELS.shop_name, FIELD_LABELS.shop_phone, FIELD_LABELS.shop_address);
        }
        if (custRes.rows.length > 0) {
          const c = custRes.rows[0] as unknown as { id: string; customer_name: string; customer_phone: string; customer_address: string; updated_at: string };
          customer = { id: c.id, customer_name: c.customer_name, customer_phone: c.customer_phone, customer_address: c.customer_address ?? "", updated_at: c.updated_at };
          filledFields.push(FIELD_LABELS.customer_name, FIELD_LABELS.customer_phone, FIELD_LABELS.customer_address);
        }
        if (requester && customer) {
          const unique = [...new Set(filledFields)];
          return NextResponse.json({
            matched: true,
            matchType: "reception_no",
            requester,
            customer,
            filledFields: unique,
          } satisfies PastDataSearchResult);
        }
      }
    }

    // 2. ご依頼店名 + 電話番号で検索
    if (shop_name && shop_phone) {
      const reqRes = await client.execute({
        sql: "SELECT id, shop_name, shop_phone, shop_address, updated_at FROM requester_info WHERE shop_name = ? AND shop_phone = ? ORDER BY updated_at DESC LIMIT 1",
        args: [shop_name, shop_phone],
      });
      if (reqRes.rows.length > 0) {
        const r = reqRes.rows[0] as unknown as { id: string; shop_name: string; shop_phone: string; shop_address: string; updated_at: string };
        requester = { id: r.id, shop_name: r.shop_name, shop_phone: r.shop_phone, shop_address: r.shop_address ?? "", updated_at: r.updated_at };
        if (!filledFields.includes(FIELD_LABELS.shop_name)) filledFields.push(FIELD_LABELS.shop_name, FIELD_LABELS.shop_phone, FIELD_LABELS.shop_address);
      }
    }

    // 3. お客様名 + 自宅電話で検索
    if (customer_name && customer_phone) {
      const custRes = await client.execute({
        sql: "SELECT id, customer_name, customer_phone, customer_address, updated_at FROM customer_info WHERE customer_name = ? AND customer_phone = ? ORDER BY updated_at DESC LIMIT 1",
        args: [customer_name, customer_phone],
      });
      if (custRes.rows.length > 0) {
        const c = custRes.rows[0] as unknown as { id: string; customer_name: string; customer_phone: string; customer_address: string; updated_at: string };
        customer = { id: c.id, customer_name: c.customer_name, customer_phone: c.customer_phone, customer_address: c.customer_address ?? "", updated_at: c.updated_at };
        filledFields.push(FIELD_LABELS.customer_name, FIELD_LABELS.customer_phone, FIELD_LABELS.customer_address);
      }
    }

    // 4. お客様名 + 住所で検索
    if (customer_name && address && !customer) {
      const custRes = await client.execute({
        sql: "SELECT id, customer_name, customer_phone, customer_address, updated_at FROM customer_info WHERE customer_name = ? AND customer_address = ? ORDER BY updated_at DESC LIMIT 1",
        args: [customer_name, address],
      });
      if (custRes.rows.length > 0) {
        const c = custRes.rows[0] as unknown as { id: string; customer_name: string; customer_phone: string; customer_address: string; updated_at: string };
        customer = { id: c.id, customer_name: c.customer_name, customer_phone: c.customer_phone, customer_address: c.customer_address ?? "", updated_at: c.updated_at };
        filledFields.push(FIELD_LABELS.customer_name, FIELD_LABELS.customer_address);
      }
    }

    const hasAny = requester || customer;
    const uniqueFields = [...new Set(filledFields)];
    if (requester && !customer) matchType = "requester";
    else if (customer && !requester) matchType = customer_phone ? "customer_phone" : "customer_address";
    else if (requester && customer) matchType = "partial";

    return NextResponse.json({
      matched: !!hasAny,
      matchType: hasAny ? matchType : "partial",
      requester,
      customer,
      filledFields: uniqueFields,
    } satisfies PastDataSearchResult);
  } catch (err) {
    console.error("[api/past-data/search] error", err);
    return NextResponse.json(
      { matched: false, matchType: "partial", filledFields: [] as string[] },
      { status: 200 }
    );
  }
}
