import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

function toDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 7);
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const { searchParams } = new URL(request.url);
  const zipcode = toDigits(searchParams.get("zipcode") ?? "");
  if (zipcode.length !== 7) {
    return NextResponse.json({ ok: false, error: "invalid_zipcode" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
    const data = (await res.json().catch(() => ({}))) as {
      message?: string | null;
      results?: Array<{
        address1?: string;
        address2?: string;
        address3?: string;
      }> | null;
    };

    const first = data?.results?.[0];
    if (!first) {
      return NextResponse.json({ ok: true, address: "" });
    }

    const address = `${first.address1 ?? ""}${first.address2 ?? ""}${first.address3 ?? ""}`.trim();
    return NextResponse.json({ ok: true, address });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

