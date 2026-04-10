import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";
import { geocodeAddressServer } from "@/lib/geocode-address";

const MAX_QUERY_LENGTH = 200;
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:3000";

function pickAllowOrigin(request: NextRequest): string {
  const origin = (request.headers.get("origin") ?? "").trim();
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!origin) return configured[0] ?? DEFAULT_ALLOWED_ORIGIN;
  if (configured.length === 0) return origin;
  return configured.includes(origin) ? origin : configured[0];
}

function withCors(request: NextRequest, response: NextResponse | Response): NextResponse {
  const res =
    response instanceof NextResponse
      ? response
      : new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
  const allowOrigin = pickAllowOrigin(request);
  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Credentials を使う場合は allow-origin を必ず単一オリジンにする（* は使わない）
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

export async function OPTIONS(request: NextRequest) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}

/** Nominatim（OpenStreetMap）で住所・郵便番号を緯度経度に変換 */
export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return withCors(request, rate);

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").slice(0, MAX_QUERY_LENGTH);
  const postalCode = (searchParams.get("postalCode") ?? "").slice(0, 20);
  const raw = [postalCode, address].filter(Boolean).join(" ").trim();
  if (!raw) {
    return withCors(
      request,
      NextResponse.json({ error: "address or postalCode required" }, { status: 400 })
    );
  }
  // デモモードでは東京駅付近のモック座標を返す（UIで「デモ用サンプル」と分かるよう demo: true を付与）
  if (isDemoMode) {
    return withCors(
      request,
      NextResponse.json({
        lat: 35.6812,
        lng: 139.7671,
        demo: true,
        demoNote: "デモ用サンプル（東京駅付近）",
      })
    );
  }

  const result = await geocodeAddressServer({ address, postalCode });
  if (!result) {
    return withCors(request, NextResponse.json({ lat: null, lng: null }));
  }
  return withCors(request, NextResponse.json(result));
}
