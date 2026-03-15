import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  getAccessCookieOptions,
  isAccessPasswordConfigured,
  isAccessPasswordUnset,
} from "@/lib/access-auth";
import {
  clearFailures,
  isOverLimit,
  recordFailure,
} from "@/lib/access-login-limit";
import { checkRateLimit } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

/** 共通パスワード照合（タイミング攻撃対策） */
function verifyPassword(input: string, expected: string): boolean {
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * POST: パスワードを検証し、正しければ Cookie を発行。
 * パスワードはサーバー側でのみ比較。秘密情報はレスポンスに含めない。
 * 失敗回数が多い場合は 429 を返す簡易制限あり。
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (rate) return rate;

  // ログイン失敗が多すぎる場合は試行を拒否（15分あたり5回超過で 429）
  if (isOverLimit(request)) {
    return NextResponse.json(
      { ok: false, error: "試行回数が多すぎます。しばらく待ってからお試しください。" },
      { status: 429 }
    );
  }

  // 本番で未設定ならログイン不可（採用A: 全体を閉じる）
  if (isAccessPasswordUnset()) {
    return NextResponse.json(
      { ok: false, error: "unconfigured" },
      { status: 503 }
    );
  }

  if (!isAccessPasswordConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const input = String(body?.password ?? "").trim();
  const expected = process.env.ACCESS_PASSWORD?.trim() ?? "";

  if (!verifyPassword(input, expected)) {
    recordFailure(request);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  clearFailures(request);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE_NAME, "1", getAccessCookieOptions());
  return res;
}
