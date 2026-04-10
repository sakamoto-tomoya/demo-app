/**
 * 既存 Turso DB 向けマイグレーション（Prisma なし・直接 SQL）
 * - cases に unconfirmed_fields カラムを追加
 * - requester_info / customer_info / case_lookup テーブルを作成
 * - parts テーブルを作成（部品 CSV インポート用）
 *
 * 実行例:
 *   npx tsx scripts/migrate.ts
 *   npm run db:migrate
 */
import "./load-env";
import { createClient } from "@libsql/client";

const MIGRATION_REQUESTER_INFO = `CREATE TABLE IF NOT EXISTS requester_info (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_phone TEXT NOT NULL,
  shop_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const MIGRATION_IDX_REQUESTER = `CREATE INDEX IF NOT EXISTS idx_requester_shop_phone ON requester_info (shop_name, shop_phone)`;

const MIGRATION_CUSTOMER_INFO = `CREATE TABLE IF NOT EXISTS customer_info (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const MIGRATION_IDX_CUSTOMER_PHONE = `CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_info (customer_name, customer_phone)`;
const MIGRATION_IDX_CUSTOMER_ADDRESS = `CREATE INDEX IF NOT EXISTS idx_customer_address ON customer_info (customer_name, customer_address)`;

const MIGRATION_CASE_LOOKUP = `CREATE TABLE IF NOT EXISTS case_lookup (
  id TEXT PRIMARY KEY,
  reception_no TEXT NOT NULL UNIQUE,
  requester_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (requester_id) REFERENCES requester_info(id),
  FOREIGN KEY (customer_id) REFERENCES customer_info(id)
)`;

const MIGRATION_IDX_CASE_LOOKUP = `CREATE INDEX IF NOT EXISTS idx_case_lookup_reception ON case_lookup (reception_no)`;

const MIGRATION_PARTS = `CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  manufacturer TEXT,
  model TEXT,
  part_number TEXT,
  part_name TEXT,
  symptom TEXT,
  note TEXT,
  created_at TEXT
)`;
const MIGRATION_IDX_PARTS_PN = `CREATE INDEX IF NOT EXISTS idx_parts_part_number ON parts (part_number)`;
const MIGRATION_IDX_PARTS_MM = `CREATE INDEX IF NOT EXISTS idx_parts_manufacturer_model ON parts (manufacturer, model)`;

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("エラー: TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env.local に設定してください。");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  console.log("マイグレーションを実行しています...");

  // ① cases に unconfirmed_fields がなければ追加
  try {
    const tableInfo = await client.execute({
      sql: "PRAGMA table_info(cases)",
      args: [],
    });
    const hasUnconfirmed = (tableInfo.rows as { name?: string }[]).some(
      (r) => r.name === "unconfirmed_fields"
    );
    if (!hasUnconfirmed) {
      await client.execute({
        sql: "ALTER TABLE cases ADD COLUMN unconfirmed_fields TEXT",
        args: [],
      });
      console.log("  ✓ cases に unconfirmed_fields を追加しました");
    } else {
      console.log("  - cases.unconfirmed_fields は既に存在します");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table: cases")) {
      console.log("  - cases テーブルが存在しないため unconfirmed_fields の追加をスキップしました（db:init で作成してください）");
    } else {
      throw err;
    }
  }

  // ② requester_info / customer_info / case_lookup を作成
  const createStatements = [
    { name: "requester_info", sql: MIGRATION_REQUESTER_INFO },
    { name: "idx_requester_shop_phone", sql: MIGRATION_IDX_REQUESTER },
    { name: "customer_info", sql: MIGRATION_CUSTOMER_INFO },
    { name: "idx_customer_phone", sql: MIGRATION_IDX_CUSTOMER_PHONE },
    { name: "idx_customer_address", sql: MIGRATION_IDX_CUSTOMER_ADDRESS },
    { name: "case_lookup", sql: MIGRATION_CASE_LOOKUP },
    { name: "idx_case_lookup_reception", sql: MIGRATION_IDX_CASE_LOOKUP },
  ];

  for (const { name, sql } of createStatements) {
    await client.execute({ sql, args: [] });
    console.log(`  ✓ ${name}`);
  }

  // ③ parts（CSV インポート用）
  const partsStatements = [
    { name: "parts", sql: MIGRATION_PARTS },
    { name: "idx_parts_part_number", sql: MIGRATION_IDX_PARTS_PN },
    { name: "idx_parts_manufacturer_model", sql: MIGRATION_IDX_PARTS_MM },
  ];
  for (const { name, sql } of partsStatements) {
    await client.execute({ sql, args: [] });
    console.log(`  ✓ ${name}`);
  }

  // ④ ocr_training_data に使用部品カラム（既存 DB 向け）
  const ocrPartCols = ["part_number", "part_name", "used_parts_json"] as const;
  try {
    const tableInfo = await client.execute({
      sql: "PRAGMA table_info(ocr_training_data)",
      args: [],
    });
    const names = new Set(
      (tableInfo.rows as { name?: string }[]).map((r) => r.name).filter(Boolean) as string[]
    );
    for (const col of ocrPartCols) {
      if (!names.has(col)) {
        await client.execute({
          sql: `ALTER TABLE ocr_training_data ADD COLUMN ${col} TEXT`,
          args: [],
        });
        console.log(`  ✓ ocr_training_data.${col} を追加しました`);
      } else {
        console.log(`  - ocr_training_data.${col} は既に存在します`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table: ocr_training_data")) {
      console.log("  - ocr_training_data が無いためカラム追加をスキップ（db:init で作成してください）");
    } else {
      throw err;
    }
  }

  console.log("マイグレーションが完了しました。");
}

main().catch((err) => {
  console.error("マイグレーション中にエラーが発生しました:", err.message);
  process.exit(1);
});
