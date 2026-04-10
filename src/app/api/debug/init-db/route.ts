import { guardDebugRoute } from "@/lib/debug-route-guard";
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { INIT_DB_STATEMENTS } from "@/lib/turso-schema";

// 開発用: Turso に Paloma 修理業務用の初期テーブルを作成する API
// 何度叩いても安全（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）。
// 本番デプロイ時は権限管理を行うか、このエンドポイントを削除してください。

export async function POST(request: NextRequest) {
  const guard = await guardDebugRoute(request);
  if (guard) return guard;

  const client = getTursoClient();

  try {
    for (const sql of INIT_DB_STATEMENTS) {
      await client.execute(sql);
    }

    return NextResponse.json({
      ok: true,
      message:
        "初期テーブルの作成が完了しました。（cases / parts_master / parts / completed_cases_knowledge / ai_response_logs / ocr_training_data / requester_info / customer_info / case_lookup）",
    });
  } catch (error) {
    console.error("[init-db] error while creating tables", error);
    return NextResponse.json(
      {
        ok: false,
        error: "初期テーブルの作成中にエラーが発生しました。詳細はサーバーログを確認してください。",
      },
      { status: 500 }
    );
  }
}

