import { cookies } from "next/headers";
import { getEffectivePassword } from "@/lib/settings-password";

const COOKIE_NAME = "settings_access";

/**
 * 設定画面・設定APIの認証。
 * 本番でパスワードが未設定の場合は認証失敗（設定を外部公開しない）。
 */
export async function requireSettingsAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const expected = getEffectivePassword();
  if (process.env.NODE_ENV === "production" && (!expected || expected === "")) {
    return false;
  }
  if (!expected || expected === "") return true;
  return token === "1";
}

/** 本番でパスワードが未設定か（設定画面を「利用不可」表示するため） */
export function isSettingsUnconfigured(): boolean {
  return process.env.NODE_ENV === "production" && !getEffectivePassword();
}
