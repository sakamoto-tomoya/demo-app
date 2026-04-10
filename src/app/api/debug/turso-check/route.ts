import { guardDebugRoute } from "@/lib/debug-route-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

// 開発用: Turso への最低限の接続確認 API
// 本番デプロイ時は、このエンドポイントを削除するか保護してください。

export async function GET(request: NextRequest) {
  const guard = await guardDebugRoute(request);
  if (guard) return guard;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "TURSO_DATABASE_URL または TURSO_AUTH_TOKEN が未設定です。",
      },
      { status: 500 }
    );
  }

  try {
    const client = createClient({ url, authToken });
    const row = await client.execute("SELECT 1 as x");
    const value = Array.isArray(row.rows) && row.rows[0] ? (row.rows[0] as any).x : null;

    return NextResponse.json({
      ok: true,
      result: value,
    });
  } catch (error) {
    console.error("[turso-check] connection error", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Turso 接続でエラーが発生しました。詳細はサーバーログを確認してください。",
      },
      { status: 500 }
    );
  }
}

