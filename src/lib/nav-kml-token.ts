import { createHmac, timingSafeEqual } from "crypto";

export type NavKmlPoint = {
  order: number;
  lat: number;
  lng: number;
  /** ポップアップ用（短く） */
  title: string;
};

function getSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NAV_KML_SECRET ?? "";
  if (s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") return "nav-kml-dev-only-not-for-production";
  throw new Error("AUTH_SECRET (or NAV_KML_SECRET) is required for nav KML signing in production");
}

/** 署名付きトークン（GET で KML を返すときに使用。Google が取得するため Cookie 不要） */
export function signNavKmlPayload(points: NavKmlPoint[]): string {
  const exp = Date.now() + 60 * 60 * 1000; // 1h
  const payload = JSON.stringify({ points, exp });
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const bundle = JSON.stringify({ p: payload, s: sig });
  return Buffer.from(bundle, "utf8").toString("base64url");
}

export function verifyNavKmlToken(c: string): NavKmlPoint[] | null {
  try {
    const bundle = JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as { p: string; s: string };
    const expected = createHmac("sha256", getSecret()).update(bundle.p).digest("base64url");
    const a = Buffer.from(bundle.s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(bundle.p) as { points: NavKmlPoint[]; exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (!Array.isArray(data.points) || data.points.length === 0) return null;
    if (data.points.length > 40) return null;
    for (const pt of data.points) {
      if (
        typeof pt.order !== "number" ||
        typeof pt.lat !== "number" ||
        typeof pt.lng !== "number" ||
        !Number.isFinite(pt.lat) ||
        !Number.isFinite(pt.lng) ||
        typeof pt.title !== "string"
      ) {
        return null;
      }
    }
    return data.points;
  } catch {
    return null;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** KML: Placemark の name に番号を表示（Google マップでピンラベルに近い表示） */
export function buildNavKml(points: NavKmlPoint[]): string {
  const sorted = [...points].sort((a, b) => a.order - b.order);
  const placemarks = sorted
    .map((pt) => {
      const name = `${pt.order}`;
      const desc = escapeXml(pt.title.slice(0, 200));
      return `<Placemark>
  <name>${escapeXml(name)}</name>
  <description>${desc}</description>
  <Point><coordinates>${pt.lng},${pt.lat},0</coordinates></Point>
</Placemark>`;
    })
    .join("\n");

  const lineCoords = sorted.map((pt) => `${pt.lng},${pt.lat},0`).join(" ");
  const lineString =
    sorted.length >= 2
      ? `<Placemark>
  <name>訪問ルート（概略）</name>
  <LineString>
    <tessellate>1</tessellate>
    <coordinates>${lineCoords}</coordinates>
  </LineString>
</Placemark>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>訪問順（番号付き）</name>
  <description>業務管理アプリから出力。各マーカーの名前が訪問順の番号です。</description>
  ${placemarks}
  ${lineString}
</Document>
</kml>`;
}
