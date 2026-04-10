/**
 * Paloma 修理業務管理用 Turso 初期テーブルを 1 回で作成するスクリプト。
 * 何度実行しても安全です（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）。
 *
 * 実行例:
 *   npx tsx scripts/init-db.ts
 * または:
 *   npm run db:init
 */
import "./load-env";
import { createClient } from "@libsql/client";
import { INIT_DB_STATEMENTS } from "../src/lib/turso-schema";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("エラー: TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env.local に設定してください。");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  console.log("Turso に初期テーブルを作成しています...");
  for (const sql of INIT_DB_STATEMENTS) {
    await client.execute(sql);
  }
  console.log(
    "完了しました。cases / parts_master / parts / completed_cases_knowledge / ai_response_logs / ocr_training_data / requester_info / customer_info / case_lookup を作成しました。"
  );
  console.log("確認: ブラウザで http://localhost:3000/api/debug/db-tables を開いてください。");
}

main().catch((err) => {
  console.error("初期化中にエラーが発生しました:", err.message);
  process.exit(1);
});
