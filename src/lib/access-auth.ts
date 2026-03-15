import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * 共通パスワード（アクセス保護）用。
 * 環境変数 ACCESS_PASSWORD を参照。NEXT_PUBLIC_ にしない。
 */
export const ACCESS_COOKIE_NAME = "access_gate";

// 短すぎず長すぎない現実的な期間: デフォルト3日。環境変数で 1〜30 日の範囲で上書き可能。
const COOKIE_MAX_AGE_DAYS = Math.min(
  30,
  Math.max(1, Number(process.env.ACCESS_COOKIE_MAX_AGE_DAYS) || 3)
);
const COOKIE_MAX_AGE = 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS;

/** 本番で ACCESS_PASSWORD が未設定か（採用A: 未設定なら全体を閉じる） */
export function isAccessPasswordUnset(): boolean {
  const v = process.env.ACCESS_PASSWORD;
  return process.env.NODE_ENV === "production" && (!v || String(v).trim() === "");
}

/** 共通パスワードが設定されているか（設定されていれば認証ゲートを有効にする） */
export function isAccessPasswordConfigured(): boolean {
  const v = process.env.ACCESS_PASSWORD;
  return !!v && String(v).trim() !== "";
}

/**
 * Cookie オプション（API で Set-Cookie に使う）。
 * 本番では必ず secure: true。localhost 開発時は secure: false で動作。
 */
export function getAccessCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}

/**
 * 重要 API 用: アクセス保護が有効な場合に Cookie を検証する。
 * 未認証なら 401 の NextResponse を返す。認証不要 or 認証済みなら null。
 */
export async function requireAccessAuth(): Promise<NextResponse | null> {
  if (!isAccessPasswordConfigured()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (token === "1") return null;
  return NextResponse.json({ error: "アクセス認証が必要です" }, { status: 401 });
}
