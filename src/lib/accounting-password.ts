import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PASSWORD_FILE = "accounting-password";
const DATA_DIR = "data";

function getPasswordFilePath(): string {
  return join(process.cwd(), DATA_DIR, PASSWORD_FILE);
}

/**
 * 経理担当者用パスワード（銀行入金データ設定のアクセス用）。
 * data/accounting-password が存在すればその内容、なければ ACCOUNTING_PASSWORD 環境変数を使用。
 */
export function getEffectiveAccountingPassword(): string {
  const path = getPasswordFilePath();
  try {
    if (existsSync(path)) {
      const value = readFileSync(path, "utf8").trim();
      if (value) return value;
    }
  } catch {
    // ignore
  }
  return process.env.ACCOUNTING_PASSWORD ?? "";
}
