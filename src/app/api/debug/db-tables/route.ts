import { guardDebugRoute } from "@/lib/debug-route-guard";
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { EXPECTED_TABLES } from "@/lib/turso-schema";

// 開発用: 現在の DB に存在するユーザーテーブル一覧を返す API
// 本番デプロイ時は、権限管理を行うか、このエンドポイントを削除してください。

export async function GET(request: NextRequest) {
  const guard = await guardDebugRoute(request);
  if (guard) return guard;

  const client = getTursoClient();

  try {
    const res = await client.execute(
      `
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
      `
    );

    const tables = res.rows.map((row) => (row as any).name as string);
    const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
    const allPresent = missing.length === 0;

    return NextResponse.json({
      ok: true,
      tables,
      expectedTables: EXPECTED_TABLES,
      allExpectedPresent: allPresent,
      missingTables: missing.length > 0 ? missing : undefined,
    });
  } catch (error) {
    console.error("[db-tables] error while listing tables", error);
    return NextResponse.json(
      {
        ok: false,
        error: "テーブル一覧の取得中にエラーが発生しました。詳細はサーバーログを確認してください。",
      },
      { status: 500 }
    );
  }
}

