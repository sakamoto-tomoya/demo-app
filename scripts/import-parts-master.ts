/**
 * public/parts_master.csv を Turso の parts テーブルへ取り込む。
 * 1行目はヘッダー（列名: id, manufacturer, model, part_number, part_name, symptom, note, created_at）。
 * id が空なら UUID を採番。created_at が空なら取り込み時刻（ISO）。
 * part_number は保存前にハイフン類をすべて除去（例: 58-21450-00 → 582145000、303253800 はそのまま）。
 *
 * 実行: npm run db:import-parts
 */
import "./load-env";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@libsql/client";

const CSV_REL = path.join("public", "parts_master.csv");

/** ダブルクォート対応の1行パース */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase();
}

/** 品番を DB 保存用に正規化（ASCII/全角などハイフン類をすべて除去） */
function normalizePartNumberForStorage(raw: string): string {
  return raw
    .replace(/[\u002D\u00AD\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "")
    .trim();
}

const ALLOWED = new Set([
  "id",
  "manufacturer",
  "model",
  "part_number",
  "part_name",
  "symptom",
  "note",
  "created_at",
]);

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("エラー: TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env.local に設定してください。");
    process.exit(1);
  }

  const csvPath = path.join(process.cwd(), CSV_REL);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV が見つかりません: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) {
    console.error("CSV が空です。");
    process.exit(1);
  }
  if (lines.length < 2) {
    console.log("ヘッダーのみです。データ行があれば npm run db:import-parts を再実行してください。");
    return;
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headerCells.length; i++) {
    const key = headerCells[i];
    if (ALLOWED.has(key)) colIndex[key] = i;
  }
  const required = ["manufacturer", "model", "part_number", "part_name"] as const;
  const missing = required.filter((k) => colIndex[k] === undefined);
  if (missing.length > 0) {
    console.error("CSV ヘッダーに不足があります: " + missing.join(", "));
    console.error("期待する列名: id, manufacturer, model, part_number, part_name, symptom, note, created_at");
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  const now = new Date().toISOString();
  const batch: { sql: string; args: (string | null)[] }[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    const get = (key: string): string => {
      const idx = colIndex[key];
      if (idx === undefined || idx >= cells.length) return "";
      return (cells[idx] ?? "").trim();
    };

    let id = get("id");
    if (!id) id = randomUUID();

    const manufacturer = get("manufacturer");
    const model = get("model");
    const partNumber = normalizePartNumberForStorage(get("part_number"));
    const partName = get("part_name");
    const symptom = get("symptom");
    const note = get("note");
    let createdAt = get("created_at");
    if (!createdAt) createdAt = now;

    if (!partNumber && !partName && !manufacturer && !model) {
      continue;
    }

    batch.push({
      sql: `INSERT OR REPLACE INTO parts (id, manufacturer, model, part_number, part_name, symptom, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        manufacturer || null,
        model || null,
        partNumber || null,
        partName || null,
        symptom || null,
        note || null,
        createdAt,
      ],
    });
  }

  if (batch.length === 0) {
    console.log("取り込むデータ行がありませんでした。");
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const slice = batch.slice(i, i + chunkSize);
    await client.batch(slice);
  }

  console.log(`完了: ${batch.length} 件を parts に書き込みました。`);
}

main().catch((err) => {
  console.error("インポート中にエラー:", err instanceof Error ? err.message : err);
  process.exit(1);
});
