import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildNavKml, signNavKmlPayload, verifyNavKmlToken, type NavKmlPoint } from "@/lib/nav-kml-token";

/**
 * POST: 訪問点から署名トークンを発行（ログイン＋アクセスCookie）
 * GET: トークンを検証して KML を返す（Google マップが取得。Cookie なし）
 */
export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { points?: NavKmlPoint[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body?.points;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "points が必要です" }, { status: 400 });
  }
  const points: NavKmlPoint[] = raw.slice(0, 40).map((pt, i) => ({
    order: typeof pt?.order === "number" ? pt.order : i + 1,
    lat: Number(pt?.lat),
    lng: Number(pt?.lng),
    title: typeof pt?.title === "string" ? pt.title.slice(0, 200) : "",
  }));
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      return NextResponse.json({ error: "座標が不正です" }, { status: 400 });
    }
  }

  try {
    const c = signNavKmlPayload(points);
    return NextResponse.json({ c });
  } catch (e) {
    console.error("[nav-kml] sign", e);
    return NextResponse.json(
      { error: "サーバー設定（AUTH_SECRET 等）が不足している可能性があります。" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const c = request.nextUrl.searchParams.get("c")?.trim();
  if (!c) {
    return NextResponse.json({ error: "c が必要です" }, { status: 400 });
  }

  const points = verifyNavKmlToken(c);
  if (!points) {
    return NextResponse.json({ error: "無効または期限切れのリンクです" }, { status: 400 });
  }

  const kml = buildNavKml(points);
  return new NextResponse(kml, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
