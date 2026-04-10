import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";

const MAX_ROWS = 2000;

/** LIKE 用に % _ \ をエスケープし、前後に % を付ける */
function toLikeContainsPattern(raw: string): string {
  const esc = raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${esc}%`;
}

/**
 * GET /api/parts/search?model=JT-611W
 * Turso `parts` で model / part_name / symptom のいずれかに部分一致（LIKE）する部品を返す。
 */
export async function GET(request: NextRequest) {
  const model = (request.nextUrl.searchParams.get("model") ?? "").trim();
  if (!model) {
    return NextResponse.json({ error: "model query parameter is required" }, { status: 400 });
  }

  const pattern = toLikeContainsPattern(model);

  try {
    const client = getTursoClient();
    const res = await client.execute({
      sql: `SELECT part_number, part_name, symptom, note
            FROM parts
            WHERE model LIKE ? ESCAPE '\\'
               OR part_name LIKE ? ESCAPE '\\'
               OR IFNULL(symptom, '') LIKE ? ESCAPE '\\'
            ORDER BY part_number ASC
            LIMIT ?`,
      args: [pattern, pattern, pattern, MAX_ROWS],
    });

    type Row = { part_number?: unknown; part_name?: unknown; symptom?: unknown; note?: unknown };
    const parts = (res.rows as Row[]).map((row) => ({
      part_number: row.part_number != null ? String(row.part_number) : "",
      part_name: row.part_name != null ? String(row.part_name) : "",
      symptom: row.symptom != null ? String(row.symptom) : "",
      note: row.note != null ? String(row.note) : "",
    }));

    return NextResponse.json({ parts });
  } catch (e) {
    console.error("[api/parts/search]", e);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
