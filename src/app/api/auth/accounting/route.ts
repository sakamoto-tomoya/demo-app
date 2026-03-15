import { loadSettingsUsers } from "@/lib/settings-users";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "accounting_access";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24時間

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return secret || "accounting-cookie-secret";
}

function sign(userId: string): string {
  return createHmac("sha256", getSecret()).update(userId).digest("base64url");
}

function verifyToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}

/** 経理担当者（銀行設定）の認証状態を確認。Cookie のユーザーが経理担当なら ok */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const userId = verifyToken(token);
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const users = loadSettingsUsers();
  const user = users.find((u) => u.id === userId);
  if (!user || !user.accounting) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, name: user.name });
}

/** メールアドレス＋パスワードでログイン。経理担当のみ成功 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const users = loadSettingsUsers();
  const user = users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (user.password !== password) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!user.accounting) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const value = `${user.id}.${sign(user.id)}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
