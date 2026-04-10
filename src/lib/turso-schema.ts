/**
 * Paloma 前提の修理業務管理用 Turso 初期スキーマ。
 * init-db API と scripts/init-db.ts の両方で利用。
 * 何度実行しても安全（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）。
 */

export const INIT_DB_STATEMENTS: string[] = [
  // ---- 1. cases（受付案件） ----
  `CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_no TEXT,
  manufacturer TEXT NOT NULL,
  product_category TEXT,
  model TEXT,
  serial_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  inquiry TEXT,
  symptom TEXT,
  error_code TEXT,
  reception_channel TEXT,
  used_parts TEXT,
  work_detail TEXT,
  note TEXT,
  ai_summary TEXT,
  ai_possible_cause TEXT,
  ai_candidate_parts TEXT,
  status TEXT DEFAULT 'new',
  unconfirmed_fields TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  /* 既存DBに unconfirmed_fields を追加する場合: ALTER TABLE cases ADD COLUMN unconfirmed_fields TEXT; を1回実行 */

  `CREATE INDEX IF NOT EXISTS idx_cases_case_no ON cases (case_no)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_manufacturer_model ON cases (manufacturer, model)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_error_code ON cases (error_code)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status)`,

  // ---- 2. parts_master（部品マスタ） ----
  `CREATE TABLE IF NOT EXISTS parts_master (
  id TEXT PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  product_category TEXT,
  model TEXT,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  symptom TEXT,
  cause TEXT,
  compatible_models TEXT,
  stock_note TEXT,
  note TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE INDEX IF NOT EXISTS idx_parts_master_part_number ON parts_master (part_number)`,
  `CREATE INDEX IF NOT EXISTS idx_parts_master_manufacturer_model ON parts_master (manufacturer, model)`,
  `CREATE INDEX IF NOT EXISTS idx_parts_master_manufacturer_category ON parts_master (manufacturer, product_category)`,

  // ---- 2b. parts（部品マスタ CSV インポート用・parts_master とは別） ----
  `CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  manufacturer TEXT,
  model TEXT,
  part_number TEXT,
  part_name TEXT,
  symptom TEXT,
  note TEXT,
  created_at TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_parts_part_number ON parts (part_number)`,
  `CREATE INDEX IF NOT EXISTS idx_parts_manufacturer_model ON parts (manufacturer, model)`,

  // ---- 3. completed_cases_knowledge（完了案件ナレッジ） ----
  `CREATE TABLE IF NOT EXISTS completed_cases_knowledge (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  manufacturer TEXT NOT NULL,
  product_category TEXT,
  model TEXT,
  symptom TEXT,
  error_code TEXT,
  cause TEXT,
  used_parts TEXT,
  work_detail TEXT,
  resolution TEXT,
  visit_result TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE INDEX IF NOT EXISTS idx_completed_knowledge_mfg_model ON completed_cases_knowledge (manufacturer, model)`,
  `CREATE INDEX IF NOT EXISTS idx_completed_knowledge_error_code ON completed_cases_knowledge (error_code)`,
  `CREATE INDEX IF NOT EXISTS idx_completed_knowledge_symptom ON completed_cases_knowledge (symptom)`,

  // ---- 4. ai_response_logs（AI回答ログ） ----
  `CREATE TABLE IF NOT EXISTS ai_response_logs (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  manufacturer TEXT,
  model TEXT,
  input_text TEXT,
  output_summary TEXT,
  output_possible_cause TEXT,
  output_candidate_parts TEXT,
  output_confidence TEXT,
  prompt_version TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE INDEX IF NOT EXISTS idx_ai_response_logs_case_id ON ai_response_logs (case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_response_logs_mfg_model ON ai_response_logs (manufacturer, model)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_response_logs_prompt_version ON ai_response_logs (prompt_version)`,

  // ---- 5. ocr_training_data（OCR手修正データ・Studio再トレーニング用） ----
  `CREATE TABLE IF NOT EXISTS ocr_training_data (
  id TEXT PRIMARY KEY,
  pdf_file_name TEXT NOT NULL,
  shop_name TEXT,
  shop_kana TEXT,
  shop_manager TEXT,
  shop_phone TEXT,
  shop_fax TEXT,
  shop_zip TEXT,
  shop_address TEXT,
  reception_no TEXT,
  customer_name TEXT,
  customer_kana TEXT,
  customer_zip TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  customer_mobile TEXT,
  model TEXT,
  model_display TEXT,
  gas_type TEXT,
  received_at TEXT,
  visit_date TEXT,
  visit_time TEXT,
  warranty TEXT,
  payment TEXT,
  inquiry TEXT,
  internal_note TEXT,
  repair_history TEXT,
  part_number TEXT,
  part_name TEXT,
  used_parts_json TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_ocr_training_data_created_at ON ocr_training_data (created_at)`,

  // ---- 6. 過去データ自動反映用（依頼元・お客様の検索） ----
  `CREATE TABLE IF NOT EXISTS requester_info (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_phone TEXT NOT NULL,
  shop_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_requester_shop_phone ON requester_info (shop_name, shop_phone)`,

  `CREATE TABLE IF NOT EXISTS customer_info (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_info (customer_name, customer_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_address ON customer_info (customer_name, customer_address)`,

  `CREATE TABLE IF NOT EXISTS case_lookup (
  id TEXT PRIMARY KEY,
  reception_no TEXT NOT NULL UNIQUE,
  requester_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (requester_id) REFERENCES requester_info(id),
  FOREIGN KEY (customer_id) REFERENCES customer_info(id)
)`,
  `CREATE INDEX IF NOT EXISTS idx_case_lookup_reception ON case_lookup (reception_no)`,
];

/** 初期化で作成する想定テーブル名（確認用） */
export const EXPECTED_TABLES = [
  "cases",
  "parts_master",
  "parts",
  "completed_cases_knowledge",
  "ai_response_logs",
  "ocr_training_data",
  "requester_info",
  "customer_info",
  "case_lookup",
];

/*
  === サンプル INSERT（テスト用・本番では実行しない） ===

  -- cases に 1 件
  INSERT INTO cases (id, case_no, manufacturer, product_category, model, customer_name, inquiry, symptom, status, created_at, updated_at)
  VALUES ('test-case-1', 'R-001', 'Paloma', '給湯器', 'FHE2421SAWL', 'テスト太郎', 'お湯が出ない', '点火不良', 'new', datetime('now'), datetime('now'));

  -- parts_master に 1 件
  INSERT INTO parts_master (id, manufacturer, product_category, part_number, part_name, symptom, is_active, created_at, updated_at)
  VALUES ('test-part-1', 'Paloma', '給湯器', '303230500', 'IGFR電極セット', '点火不良', 1, datetime('now'), datetime('now'));

  -- completed_cases_knowledge に 1 件
  INSERT INTO completed_cases_knowledge (id, case_id, manufacturer, product_category, model, symptom, cause, used_parts, work_detail, resolution, visit_result, created_at, updated_at)
  VALUES ('test-know-1', 'test-case-1', 'Paloma', '給湯器', 'FHE2421SAWL', '点火不良', 'IGFR電極不良', '303230500', '点検・部品交換', '交換後正常', '完了', datetime('now'), datetime('now'));

  -- ai_response_logs に 1 件
  INSERT INTO ai_response_logs (id, case_id, manufacturer, model, input_text, output_summary, output_possible_cause, output_candidate_parts, prompt_version, created_at, updated_at)
  VALUES ('test-ai-1', 'test-case-1', 'Paloma', 'FHE2421SAWL', 'お湯が出ない', '点火系を確認', 'IGFR電極不良の可能性', '303230500', 'v1', datetime('now'), datetime('now'));
*/
