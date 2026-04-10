import { isDemoMode } from "@/lib/demo-mode";

const MAX_QUERY_LENGTH = 200;

/**
 * サーバー側で住所・郵便番号から緯度経度を取得（Nominatim）。
 * `/api/geocode` と同じロジック。
 */
export async function geocodeAddressServer(opts: {
  address?: string;
  postalCode?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const address = (opts.address ?? "").slice(0, MAX_QUERY_LENGTH);
  const postalCode = (opts.postalCode ?? "").slice(0, 20);
  const raw = [postalCode, address].filter(Boolean).join(" ").trim();
  if (!raw) return null;

  if (isDemoMode) {
    return { lat: 35.6812, lng: 139.7671 };
  }

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
  if (!result && postalCode.replace(/\D/g, "").length === 7) {
    const code = postalCode.replace(/\D/g, "").slice(0, 7);
    result = await doSearch(`${code} 日本`);
  }
  return result;
}
