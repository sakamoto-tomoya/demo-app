"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { getAllCases, updateCase } from "@/lib/store";
import type { CaseRecord, CaseStatus } from "@/lib/types";
import { CASE_STATUS_LABELS, getStatusLabel } from "@/lib/types";

const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671]; // 東京
const DEFAULT_ZOOM = 10;

/** 案件ごとのジオコーディングを同時に走らせる上限（Nominatim 負荷とブラウザ接続数のバランス） */
const GEOCODE_CONCURRENCY = 6;

/** `/api/geocode` 同一クエリの結果を再利用（マーカー・ナビの二重取得も防ぐ） */
const GEOCODE_CACHE = new Map<string, { lat: number; lng: number } | null>();
const GEOCODE_INFLIGHT = new Map<string, Promise<{ lat: number; lng: number } | null>>();

function stableGeocodeKey(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function isLikelyJapanCoord(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154;
}

function fallbackCoordsFromAddress(address: string): { lat: number; lng: number } | null {
  const a = (address ?? "").replace(/\s+/g, "");
  if (!a) return null;
  if (a.includes("横浜市戸塚区")) return { lat: 35.4008, lng: 139.5341 };
  if (a.includes("横浜市")) return { lat: 35.4437, lng: 139.6380 };
  if (a.includes("川崎市")) return { lat: 35.5308, lng: 139.7036 };
  if (a.includes("東京都")) return { lat: 35.6812, lng: 139.7671 };
  // 横浜・川崎以外の神奈川（鎌倉・藤沢等）でジオコーディングが失敗したときの最終手段（複数件で座標が重なる場合あり）
  if (a.includes("神奈川県")) return { lat: 35.43, lng: 139.36 };
  return null;
}

async function fetchGeocodeCached(params: URLSearchParams): Promise<{ lat: number; lng: number } | null> {
  const key = stableGeocodeKey(params);
  if (GEOCODE_CACHE.has(key)) return GEOCODE_CACHE.get(key)!;
  const inflight = GEOCODE_INFLIGHT.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const res = await fetch(`/api/geocode?${params.toString()}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { lat: number | null; lng: number | null };
      if (
        data.lat != null &&
        data.lng != null &&
        isLikelyJapanCoord(Number(data.lat), Number(data.lng))
      ) {
        return { lat: Number(data.lat), lng: Number(data.lng) };
      }
      return null;
    } finally {
      GEOCODE_INFLIGHT.delete(key);
    }
  })();

  GEOCODE_INFLIGHT.set(key, p);
  const result = await p;
  GEOCODE_CACHE.set(key, result);
  return result;
}

/** 案件リストをプール実行（直列 await の合計時間を抑える） */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const n = Math.min(Math.max(limit, 1), Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function resolveCoordsForCase(c: CaseRecord): Promise<{ lat: number; lng: number } | null> {
  const latNum = typeof c.lat === "number" ? c.lat : Number(c.lat);
  const lngNum = typeof c.lng === "number" ? c.lng : Number(c.lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) && isLikelyJapanCoord(latNum, lngNum)) {
    return { lat: latNum, lng: lngNum };
  }
  const address = (c.address ?? "").trim();
  const postalCode = (c.postalCode ?? "").trim();
  if (!address && !postalCode) return null;

  const addressCandidates = Array.from(
    new Set(
      [
        address,
        address.replace(/\s+/g, ""),
        address.startsWith("神奈川県") ? address : `神奈川県${address}`,
        address.startsWith("神奈川県") ? address.replace(/^神奈川県/, "") : "",
      ].filter((v) => !!v.trim())
    )
  );

  for (const addr of addressCandidates) {
    const params = new URLSearchParams();
    params.set("address", addr);
    if (postalCode) params.set("postalCode", postalCode);
    const coords = await fetchGeocodeCached(params);
    if (coords) return coords;
  }

  if (postalCode.replace(/\D/g, "").length === 7) {
    const params = new URLSearchParams();
    params.set("postalCode", postalCode);
    const coords = await fetchGeocodeCached(params);
    if (coords) return coords;
  }

  const fallback = fallbackCoordsFromAddress(address);
  return fallback ?? null;
}

/** DB に既に有効な緯度経度があればジオコーディング不要（次回以降の表示を速くする） */
function hadValidStoredCoords(c: CaseRecord): boolean {
  const latNum = typeof c.lat === "number" ? c.lat : Number(c.lat);
  const lngNum = typeof c.lng === "number" ? c.lng : Number(c.lng);
  return Number.isFinite(latNum) && Number.isFinite(lngNum) && isLikelyJapanCoord(latNum, lngNum);
}

/** ダッシュボード地図の凡例・マーカー色（ステータスごと・マーカーと統一） */
const STATUS_MARKER_COLORS: Record<CaseStatus, { stroke: string; fill: string }> = {
  new: { stroke: "#b91c1c", fill: "#ef4444" }, // 新規：赤
  parts_order: { stroke: "#c2410c", fill: "#fb923c" }, // 部品手配中：オレンジ
  estimate: { stroke: "#c2410c", fill: "#fb923c" }, // 見積中：オレンジ（部品手配と同色）
  waiting_contact: { stroke: "#0369a1", fill: "#38bdf8" }, // 連絡待ち：水色
  no_contact: { stroke: "#9f1239", fill: "#f472b6" }, // 連絡取れず：ピンク
  visit_confirmed: { stroke: "#1d4ed8", fill: "#3b82f6" }, // 訪問日確定：青
  contact_only: { stroke: "#5b21b6", fill: "#7c3aed" }, // 連絡のみ指定：紫
  sns_sent: { stroke: "#a21caf", fill: "#e879f9" }, // 不在SNS送信済み：マゼンタ
  completed: { stroke: "#64748b", fill: "#94a3b8" }, // 完了：グレー
  cancelled: { stroke: "#0a0a0a", fill: "#171717" }, // キャンセル：黒
};

/** 表示ラベルがそのまま保存されている古いデータ向け（日本語 → 内部キー） */
const STATUS_LABEL_TO_KEY: Partial<Record<string, CaseStatus>> = Object.fromEntries(
  (Object.entries(CASE_STATUS_LABELS) as [CaseStatus, string][]).map(([key, label]) => [label, key])
) as Partial<Record<string, CaseStatus>>;

/** 凡例の並び順（進行イメージに近い順） */
const LEGEND_STATUS_ORDER: CaseStatus[] = [
  "new",
  "parts_order",
  "estimate",
  "waiting_contact",
  "no_contact",
  "visit_confirmed",
  "contact_only",
  "sns_sent",
  "completed",
  "cancelled",
];

function normalizeStatusForColor(status: string | undefined): CaseStatus | "visit_scheduled_legacy" | undefined {
  const raw = status?.trim();
  if (!raw) return undefined;
  if (raw in STATUS_MARKER_COLORS) return raw as CaseStatus;
  if (raw === "visit_scheduled") return "visit_scheduled_legacy";
  const fromLabel = STATUS_LABEL_TO_KEY[raw];
  if (fromLabel) return fromLabel;
  return undefined;
}

/** 完了除外・件数整合用（DB が内部キー／日本語ラベルどちらでも同じ扱いにする） */
function normalizeCaseStatusKey(status: string | undefined): CaseStatus | null {
  const raw = status?.trim();
  if (!raw) return null;
  if (raw in CASE_STATUS_LABELS) return raw as CaseStatus;
  if (raw === "visit_scheduled") return "visit_confirmed";
  const fromLabel = STATUS_LABEL_TO_KEY[raw];
  return fromLabel ?? null;
}

/** カレンダー一覧と同じ（全角半角スペース差で担当者が不一致にならないように） */
function normalizeAssigneeName(v: string | undefined | null): string {
  return (v ?? "").replace(/\s+/g, "").trim();
}

function getStatusMarkerColors(status: string | undefined): { stroke: string; fill: string } {
  const key = normalizeStatusForColor(status);
  if (key === "visit_scheduled_legacy") {
    return STATUS_MARKER_COLORS.visit_confirmed;
  }
  if (key && key in STATUS_MARKER_COLORS) {
    return STATUS_MARKER_COLORS[key];
  }
  return { stroke: "#94a3b8", fill: "#e2e8f0" }; // 不明・未設定：薄いグレー
}

function formatConfirmedTime(c: CaseRecord): string {
  if (c.visitTimeMorningContact) return "当日朝連絡";
  const s = (c.visitTimeStart ?? "").trim();
  const e = (c.visitTimeEnd ?? "").trim();
  if (s && e) return `${s}～${e}`;
  if (s) return s;
  if (e) return e;
  return "未設定";
}

type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;

type MapViewProps = {
  /** 指定時は URL クエリより優先してこの日付で絞り込む（yyyy-MM-dd） */
  dateFilterOverride?: string | null;
  /** 指定時は担当者でも絞り込む */
  assigneeFilter?: string | null;
  /** 指定時はステータスでも絞り込む */
  statusFilter?: CaseStatus | null;
  /** 地図に表示しないステータス（案件管理で「完了のみ除外」などに使う） */
  excludeStatuses?: CaseStatus[];
  /** マーカー選択時に案件IDを通知 */
  onActiveCaseChange?: (caseId: string | null) => void;
  /** false のとき「一括ナビ開始」を出さない（全案件ダッシュボード用） */
  showBulkNav?: boolean;
};

export default function MapView({
  dateFilterOverride,
  assigneeFilter,
  statusFilter,
  excludeStatuses,
  onActiveCaseChange,
  showBulkNav = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: LeafletMap; markers: LeafletMarker[]; L: typeof import("leaflet") } | null>(null);
  const searchParams = useSearchParams();
  /** `dateFilterOverride=""` のときは日付で絞らない（URL の ?date= も無視） */
  const dateFilter =
    dateFilterOverride !== undefined && dateFilterOverride !== null
      ? dateFilterOverride || null
      : searchParams.get("date");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  /** 日付+担当者の母集団で採番した固定順（ステータスで絞っても番号を詰めない） */
  const [orderIndexById, setOrderIndexById] = useState<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);
  /** 案件ID → 解決済み座標（マーカー・ナビで共通。ジオコーディングは1回のみ） */
  const [coordsByCaseId, setCoordsByCaseId] = useState<Record<string, { lat: number; lng: number }>>({});
  const [kmlNavLoading, setKmlNavLoading] = useState(false);

  const navItems = useMemo(() => {
    const rows: Array<{ caseId: string; orderNo: number; label: string; destination: string }> = [];
    for (const c of cases) {
      const coords = coordsByCaseId[c.id];
      if (!coords) continue;
      const orderNo = orderIndexById.get(c.id) ?? rows.length + 1;
      rows.push({
        caseId: c.id,
        orderNo,
        label: `${c.customerName || "（名称未設定）"} / ${c.address || "住所未入力"}`,
        destination: `${coords.lat},${coords.lng}`,
      });
    }
    rows.sort((a, b) => a.orderNo - b.orderNo);
    return rows;
  }, [cases, coordsByCaseId, orderIndexById]);

  const coordsResolvedCount = useMemo(
    () => cases.filter((c) => coordsByCaseId[c.id]).length,
    [cases, coordsByCaseId]
  );

  function parseMinutes(t: string | undefined): number {
    const raw = (t ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(raw)) return Number.POSITIVE_INFINITY;
    const [h, m] = raw.split(":").map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
    return h * 60 + m;
  }

  function visitTimeSortKey(c: CaseRecord): number {
    if (c.visitTimeMorningContact) return 6 * 60; // 当日朝連絡は朝枠
    return parseMinutes(c.visitTimeStart);
  }

  async function openNumberedGoogleMap() {
    const ordered = [...navItems].sort((a, b) => a.orderNo - b.orderNo);
    if (ordered.length === 0) return;
    const w = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    if (!w) {
      alert("ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
      return;
    }
    setKmlNavLoading(true);
    try {
      const points = ordered.map((i) => {
        const [latStr, lngStr] = i.destination.split(",").map((x) => x.trim());
        return {
          order: i.orderNo,
          lat: parseFloat(latStr),
          lng: parseFloat(lngStr),
          title: i.label,
        };
      });
      const res = await fetch("/api/maps/nav-kml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ points }),
      });
      const data = (await res.json().catch(() => ({}))) as { c?: string; error?: string };
      if (!res.ok || !data.c) {
        w.close();
        alert(data.error ?? "番号付きのGoogleマップを開けませんでした。");
        return;
      }
      const origin = window.location.origin;
      const kmlUrl = `${origin}/api/maps/nav-kml?c=${encodeURIComponent(data.c)}`;
      w.location.href = `https://www.google.com/maps?q=${encodeURIComponent(kmlUrl)}`;
    } catch {
      w.close();
      alert("通信に失敗しました。");
    } finally {
      setKmlNavLoading(false);
    }
  }

  function buildOrderIndex(source: CaseRecord[]): Map<string, number> {
    const sorted = [...source].sort((a, b) => {
      const ta = visitTimeSortKey(a);
      const tb = visitTimeSortKey(b);
      if (ta !== tb) return ta - tb;
      return (a.receptionNo ?? "").localeCompare(b.receptionNo ?? "");
    });
    const order = new Map<string, number>();
    sorted.forEach((c, idx) => order.set(c.id, idx + 1));
    return order;
  }

  /** ステータス色の丸マーカー（訪問順番号は表示しない） */
  function createNumberedStatusIcon(
    L: typeof import("leaflet"),
    colors: { stroke: string; fill: string }
  ): import("leaflet").DivIcon {
    const { stroke, fill } = colors;
    return L.divIcon({
      className: "visit-order-icon",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: `<div style="width:28px;height:28px;border-radius:9999px;background:${fill};border:2px solid ${stroke};box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>`,
    });
  }

  useEffect(() => {
    void (async () => {
      const all = await getAllCases();
      const byDate = dateFilter
        ? all.filter((c) => {
            const key = c.visitDate
              ? format(parseISO(c.visitDate), "yyyy-MM-dd")
              : format(parseISO(c.createdAt), "yyyy-MM-dd");
            return key === dateFilter;
          })
        : all;
      const byAssignee = assigneeFilter
        ? byDate.filter(
            (c) => normalizeAssigneeName(c.assignedTo) === normalizeAssigneeName(assigneeFilter)
          )
        : byDate;
      const excluded = excludeStatuses?.length ? new Set(excludeStatuses) : null;
      let pool = byAssignee;
      if (excluded) {
        pool = pool.filter((c) => {
          const key = normalizeCaseStatusKey(c.status);
          if (key && excluded.has(key)) return false;
          return true;
        });
      }
      setOrderIndexById(buildOrderIndex(pool));
      const list = statusFilter
        ? pool.filter((c) => normalizeCaseStatusKey(c.status) === statusFilter)
        : pool;
      setCases(list);
    })();
  }, [dateFilter, assigneeFilter, statusFilter, excludeStatuses]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cases.length === 0) {
        if (!cancelled) setCoordsByCaseId({});
        return;
      }
      const resolved = await mapPool(cases, GEOCODE_CONCURRENCY, async (c) => {
        const coords = await resolveCoordsForCase(c);
        return { id: c.id, coords };
      });
      if (cancelled) return;
      const next: Record<string, { lat: number; lng: number }> = {};
      for (const { id, coords } of resolved) {
        if (coords) next[id] = coords;
      }
      setCoordsByCaseId(next);

      const persistTasks: Promise<unknown>[] = [];
      for (const c of cases) {
        const coords = next[c.id];
        if (!coords || hadValidStoredCoords(c)) continue;
        persistTasks.push(updateCase(c.id, { lat: coords.lat, lng: coords.lng }));
      }
      if (persistTasks.length > 0) {
        void Promise.allSettled(persistTasks);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cases]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    const init = async () => {
      const L = (await import("leaflet")).default;
      const el = containerRef.current;
      if (!mounted || !el?.isConnected || mapRef.current) return;

      const map = L.map(el).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      if (!mounted || !containerRef.current) {
        map.remove();
        return;
      }

      mapRef.current = { map, markers: [], L };
      setReady(true);
    };

    void init();
    return () => {
      mounted = false;
      setReady(false);
      if (mapRef.current) {
        mapRef.current.markers.forEach((m) => m.remove());
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const { map, markers, L } = mapRef.current;
    let cancelled = false;
    markers.forEach((m) => m.remove());
    const newMarkers: LeafletMarker[] = [];
    for (const c of cases) {
        if (cancelled || !mapRef.current) return;
        const coords = coordsByCaseId[c.id];
        if (!coords) continue;
        const statusColors = getStatusMarkerColors(c.status);
        const popup = [
          `<strong>${escapeHtml(c.customerName || "（名称未設定）")}</strong>`,
          `住所: ${escapeHtml(c.address || "未入力")}`,
          `訪問確定時間: ${escapeHtml(formatConfirmedTime(c))}`,
          `担当者: ${escapeHtml((c.assignedTo ?? "").trim() || "未割当")}`,
          `<span class="text-gray-500">${getStatusLabel(c.status)}</span>`,
        ].join("<br/>");
        const marker = L.marker([coords.lat, coords.lng], {
          icon: createNumberedStatusIcon(L, statusColors),
        }).bindPopup(popup);
        try {
          marker.addTo(map);
        } catch {
          if (cancelled || !mapRef.current) return;
          continue;
        }
        marker.on("click", () => onActiveCaseChange?.(c.id));
        marker.on("popupopen", () => onActiveCaseChange?.(c.id));
        newMarkers.push(marker);
    }
    if (cancelled || !mapRef.current) return;
    mapRef.current.markers = newMarkers;

    const mapStill = mapRef.current?.map;
    if (!mapStill || cancelled) return;
    if (newMarkers.length > 0) {
      const bounds = L.featureGroup(newMarkers).getBounds().pad(0.05);
      const targetZoom = Math.min(mapStill.getBoundsZoom(bounds), 14);
      mapStill.setView(bounds.getCenter(), targetZoom);
    } else {
      mapStill.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
    return () => {
      cancelled = true;
    };
  }, [ready, cases, coordsByCaseId, onActiveCaseChange]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {dateFilter
          ? `${dateFilter}の予定を訪問時間順に地図で表示しています。`
          : statusFilter
            ? `${CASE_STATUS_LABELS[statusFilter]}の案件のみを訪問時間順に地図で表示しています（担当者による絞り込みはしていません）。`
            : "住所が登録されている案件を訪問時間順に地図で表示します。登録時に自動で緯度経度を取得しています。"}
      </p>
      {cases.length > 0 && (
        <p className="text-sm text-[var(--muted)]">
          マップ対象 {cases.length} 件／ピン表示 {coordsResolvedCount} 件
          {coordsResolvedCount < cases.length && (
            <span>（座標が取得できなかった案件はピンなし。住所・郵便番号を確認してください）</span>
          )}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
          role="region"
          aria-label="ステータス別マーカーの色"
        >
          <p className="mb-2 text-xs font-medium text-[var(--foreground)]">マーカーの色（ステータス別）</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
            {LEGEND_STATUS_ORDER.map((st) => {
              const { stroke, fill } = STATUS_MARKER_COLORS[st];
              const label = CASE_STATUS_LABELS[st];
              return (
                <li key={st} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border-2 shadow-sm"
                    style={{
                      borderColor: stroke,
                      backgroundColor: fill,
                    }}
                    aria-hidden
                  />
                  <span className="text-[var(--foreground)]">{label}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full border-2 shadow-sm"
                style={{ borderColor: "#94a3b8", backgroundColor: "#e2e8f0" }}
                aria-hidden
              />
              <span className="text-[var(--foreground)]">不明・未設定</span>
            </li>
          </ul>
        </div>
        {showBulkNav &&
          navItems.length > 0 &&
          (() => {
            const ordered = [...navItems].sort((a, b) => a.orderNo - b.orderNo);
            const waypoints = ordered.slice(0, -1).map((i) => i.destination);
            const destination = ordered[ordered.length - 1]?.destination ?? "";
            const origin = "現在地";
            const href =
              ordered.length === 1
                ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
                : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints.join("|"))}&travelmode=driving`;
            return (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 lg:min-w-[260px]">
                <p className="mb-2 text-xs font-medium text-[var(--foreground)]">訪問順ナビ（スマホ/PC）</p>
                <div className="flex flex-col gap-2">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline hover:opacity-90"
                  >
                    一括ナビ開始
                  </a>
                  <button
                    type="button"
                    disabled={kmlNavLoading}
                    onClick={() => void openNumberedGoogleMap()}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-60"
                  >
                    {kmlNavLoading ? "準備中…" : "番号付きでGoogleマップに表示"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  訪問順: {ordered.map((i) => i.orderNo).join(" → ")}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                  「番号付き」は各地点の名前に訪問順（1・2・3…）を付けたKMLをGoogleマップで開きます。車のナビ経路は「一括ナビ開始」をご利用ください。
                </p>
              </div>
            );
          })()}
      </div>
      <div
        ref={containerRef}
        className="h-[760px] w-full rounded-xl border border-[var(--border)]"
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  const div = { textContent: s };
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}
