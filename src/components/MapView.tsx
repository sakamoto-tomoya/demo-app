"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { getAllCases } from "@/lib/store";
import type { CaseRecord } from "@/lib/types";
import { getStatusLabel } from "@/lib/types";

const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671]; // 東京
const DEFAULT_ZOOM = 10;

/** 訪問日・訪問時間順にソート（地図マーカーとルート順に使用） */
function sortByVisitOrder(list: CaseRecord[]): CaseRecord[] {
  return [...list].sort((a, b) => {
    const dateA = a.visitDate || a.createdAt || "";
    const dateB = b.visitDate || b.createdAt || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.visitTimeMorningContact ? "00:00" : (a.contactAttemptTimes?.[0] ?? a.visitTimeStart ?? "00:00");
    const timeB = b.visitTimeMorningContact ? "00:00" : (b.contactAttemptTimes?.[0] ?? b.visitTimeStart ?? "00:00");
    return timeA.localeCompare(timeB);
  });
}

type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: LeafletMap; markers: LeafletMarker[]; L: typeof import("leaflet") } | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateFilter = searchParams.get("date");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname !== "/map") return;
    const all = getAllCases();
    if (!dateFilter) {
      setCases(all);
      return;
    }
    const filtered = all.filter((c) => {
      const key = c.visitDate
        ? format(parseISO(c.visitDate), "yyyy-MM-dd")
        : format(parseISO(c.createdAt), "yyyy-MM-dd");
      return key === dateFilter;
    });
    setCases(filtered);
  }, [pathname, dateFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let mounted = true;
    const init = async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const list = getAllCases();
      const withCoords = list.filter(
        (c) => c.lat != null && c.lng != null && c.status !== "completed"
      );
      const markers: LeafletMarker[] = [];
      for (const c of withCoords) {
        const marker = L.marker([c.lat!, c.lng!])
          .bindPopup(
            `<strong>${escapeHtml(c.customerName)}</strong><br/>${escapeHtml(c.address)}<br/><span class="text-gray-500">${getStatusLabel(c.status)}</span>`
          )
          .addTo(map);
        markers.push(marker);
      }

      mapRef.current = { map, markers, L };
      setReady(true);
    };

    init();
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.markers.forEach((m) => m.remove());
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const sortedByVisit = useMemo(() => {
    const withCoords = cases.filter(
      (c) => c.lat != null && c.lng != null && c.status !== "completed"
    );
    return sortByVisitOrder(withCoords);
  }, [cases]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const { map, markers, L } = mapRef.current;
    markers.forEach((m) => m.remove());
    const newMarkers: LeafletMarker[] = [];
    sortedByVisit.forEach((c, index) => {
      const timeStr = c.visitTimeMorningContact
        ? "当日朝連絡"
        : (c.contactAttemptTimes?.length ?? 0) > 0
          ? c.contactAttemptTimes!.join(", ")
          : c.visitTimeStart || c.visitTimeEnd
            ? `${c.visitTimeStart || "--"}～${c.visitTimeEnd || "--"}`
            : "";
      const orderLabel = sortedByVisit.length > 1 ? `${index + 1}. ` : "";
      const dateStr = c.visitDate || c.createdAt;
      const dateLabel = dateStr
        ? format(parseISO(dateStr), "yyyy/MM/dd", { locale: ja })
        : "";
      const popup = [
        `<strong>${orderLabel}${escapeHtml(c.customerName)}</strong>`,
        escapeHtml(c.address),
        dateLabel ? `<span class="text-gray-600">${dateLabel}</span>` : "",
        timeStr ? `<span class="text-gray-600">${escapeHtml(timeStr)}</span>` : "",
        `<span class="text-gray-500">${getStatusLabel(c.status)}</span>`,
      ]
        .filter(Boolean)
        .join("<br/>");
      const marker = L.marker([c.lat!, c.lng!]).bindPopup(popup).addTo(map);
      newMarkers.push(marker);
    });
    mapRef.current.markers = newMarkers;
  }, [ready, sortedByVisit]);

  const openNavWithOptimizedRoute = () => {
    if (sortedByVisit.length === 0) return;
    const points = sortedByVisit.map((c) => `${c.lat},${c.lng}`);
    const params = new URLSearchParams({
      api: "1",
      origin: "Current+Location",
      travelmode: "driving",
    });
    if (points.length === 1) {
      params.set("destination", points[0]);
    } else {
      params.set("waypoints", points.slice(0, -1).join("|"));
      params.set("destination", points[points.length - 1]);
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {dateFilter
          ? `${dateFilter}の予定を訪問時間順に地図で表示しています。`
          : "住所・郵便番号が登録されている案件を訪問時間順に地図で表示します。登録時に自動で緯度経度を取得しています。"}
      </p>
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-xl border border-[var(--border)]"
      />
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
          スマホでナビ
        </h3>
        <p className="mb-3 text-xs text-[var(--muted)]">
          現在地から、訪問時間順のルートをGoogleマップで開きます。ルート確認とナビができます。スマホではナビとして利用できます。
        </p>
        <button
          type="button"
          onClick={openNavWithOptimizedRoute}
          disabled={sortedByVisit.length === 0}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          現在地から訪問順ルートでナビを起動
        </button>
        {sortedByVisit.length === 0 && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            緯度・経度が登録されている案件がありません。案件登録時に住所から自動取得されます。
          </p>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  const div = { textContent: s };
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}
