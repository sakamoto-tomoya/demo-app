import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_QUERY_LENGTH = 200;

/** Nominatim（OpenStreetMap）で住所・郵便番号を緯度経度に変換 */
export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").slice(0, MAX_QUERY_LENGTH);
  const postalCode = (searchParams.get("postalCode") ?? "").slice(0, 20);
  const raw = [postalCode, address].filter(Boolean).join(" ").trim();
  if (!raw) {
    return NextResponse.json({ error: "address or postalCode required" }, { status: 400 });
  }
  // デモモードでは東京駅付近のモック座標を返す（UIで「デモ用サンプル」と分かるよう demo: true を付与）
  if (isDemoMode) {
    return NextResponse.json({
      lat: 35.6812,
      lng: 139.7671,
      demo: true,
      demoNote: "デモ用サンプル（東京駅付近）",
    });
  }
  // 日本住所でヒットしやすくするため末尾に「日本」を付与
  const q = raw.endsWith("日本") ? raw : `${raw} 日本`;

  const doSearch = async (query: string) => {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", query);
    u.searchParams.set("format", "json");
    u.searchParams.set("limit", "1");
    u.searchParams.set("countrycodes", "jp");
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": "gyoumukannri-app/1.0" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: string; lon: string }[];
    return arr?.length ? { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) } : null;
  };

  let result = await doSearch(q);
  // ヒットしなければ郵便番号のみで再試行（例: 〒216-0006）
  if (!result && postalCode.replace(/\D/g, "").length === 7) {
    const code = postalCode.replace(/\D/g, "").slice(0, 7);
    result = await doSearch(`${code} 日本`);
  }
  if (!result) {
    return NextResponse.json({ lat: null, lng: null });
  }
  return NextResponse.json(result);
}
