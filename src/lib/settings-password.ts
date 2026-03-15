import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PASSWORD_FILE = "settings-password";
const DATA_DIR = "data";

/**
 * 設定・部品管理用パスワードの保存先（プロジェクトルートの data/ 配下）。
 * ファイルが存在すればその内容、なければ process.env.SETTINGS_PASSWORD を使用。
 */
function getDataDir(): string {
  return join(process.cwd(), DATA_DIR);
}

function getPasswordFilePath(): string {
  return join(getDataDir(), PASSWORD_FILE);
}

/** 現在有効なパスワードを取得（ファイル優先、なければ環境変数） */
export function getEffectivePassword(): string {
  const path = getPasswordFilePath();
  try {
    if (existsSync(path)) {
      const value = readFileSync(path, "utf8").trim();
      if (value) return value;
    }
  } catch {
    // ファイル読めない場合は env にフォールバック
  }
  return process.env.SETTINGS_PASSWORD ?? "";
}

/** 新しいパスワードをファイルに保存（その都度変更用） */
export function savePassword(newPassword: string): void {
  const dir = getDataDir();
  const path = getPasswordFilePath();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, newPassword.trim(), "utf8");
}
