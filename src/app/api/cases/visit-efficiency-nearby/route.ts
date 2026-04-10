import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import type { CaseRecord } from "@/lib/types";
import { requireAccessAuth } from "@/lib/access-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { loadSettingsUsers } from "@/lib/settings-users";
import {
  findSettingsUserBySession,
  getVisitEfficiencyAccess,
  isVisitEfficiencyAllowed,
} from "@/lib/visit-efficiency-access";
import { geocodeAddressServer } from "@/lib/geocode-address";
import { buildVisitEfficiencySuggestions } from "@/lib/visit-efficiency-suggestions";

const CASE_TABLE = "case_records";

async function ensureCaseTable() {
  const client = getTursoClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS case_records (
      id TEXT PRIMARY KEY,
      reception_no TEXT,
      case_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_case_records_reception_no ON case_records (reception_no)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_case_records_updated_at ON case_records (updated_at)`);
}

function parseCaseJson(raw: unknown): CaseRecord | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as CaseRecord;
  } catch {
    return null;
  }
}

async function loadAllCases(): Promise<CaseRecord[]> {
  await ensureCaseTable();
  const client = getTursoClient();
  const res = await client.execute({
    sql: `SELECT case_json FROM ${CASE_TABLE} ORDER BY updated_at DESC`,
    args: [],
  });
  return res.rows
    .map((row) => parseCaseJson(row.case_json))
    .filter((row): row is CaseRecord => !!row);
}

/**
 * 訪問効率提案：近隣案件（サーバー側でロールに応じフィルタ、距離は Haversine）
 */
export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 401 });
  }

  const viewerEmail = (session.user.email as string | null | undefined) ?? null;
  const viewerName = (session.user.name as string | null | undefined) ?? null;
  const users = loadSettingsUsers();
  const viewer = findSettingsUserBySession(users, viewerEmail, viewerName);
  const access = getVisitEfficiencyAccess(viewer);

  if (!isVisitEfficiencyAllowed(access)) {
    return NextResponse.json({
      ok: true,
      featureVisible: false,
      items: [] as ReturnType<typeof buildVisitEfficiencySuggestions>,
    });
  }

  let body: {
    address?: string;
    postalCode?: string;
    excludeCaseId?: string;
    savedLat?: number | null;
    savedLng?: number | null;
    /** 編集時に住所が保存済みと同一ならクライアントが渡す（サーバーで再ジオコーディング省略可） */
    addressMatchesSaved?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const address = String(body?.address ?? "").trim();
  const postalCode = String(body?.postalCode ?? "").replace(/\D/g, "").slice(0, 7);
  const excludeCaseId = String(body?.excludeCaseId ?? "").trim();

  if (!address) {
    return NextResponse.json({ ok: false, error: "address が必要です" }, { status: 400 });
  }

  let baseLat: number | null = null;
  let baseLng: number | null = null;

  const savedLat = body.savedLat != null ? Number(body.savedLat) : null;
  const savedLng = body.savedLng != null ? Number(body.savedLng) : null;
  const useSaved =
    body.addressMatchesSaved === true &&
    savedLat != null &&
    savedLng != null &&
    Number.isFinite(savedLat) &&
    Number.isFinite(savedLng);

  if (useSaved) {
    baseLat = savedLat;
    baseLng = savedLng;
  } else {
    const geo = await geocodeAddressServer({ address, postalCode });
    if (!geo) {
      return NextResponse.json({
        ok: true,
        featureVisible: true,
        items: [],
        geocodeFailed: true,
      });
    }
    baseLat = geo.lat;
    baseLng = geo.lng;
  }

  let cases: CaseRecord[];
  try {
    cases = await loadAllCases();
  } catch (e) {
    console.error("[visit-efficiency-nearby] load cases", e);
    return NextResponse.json({ ok: false, error: "案件の取得に失敗しました" }, { status: 500 });
  }

  const items = buildVisitEfficiencySuggestions(cases, {
    baseLat: baseLat as number,
    baseLng: baseLng as number,
    excludeCaseId,
    access,
  });

  return NextResponse.json({
    ok: true,
    featureVisible: true,
    items,
  });
}
