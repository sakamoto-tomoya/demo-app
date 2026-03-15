import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, getAccessCookieOptions } from "@/lib/access-auth";

/**
 * GET: アクセス保護用 Cookie を削除し、/login へリダイレクト。
 */
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set(ACCESS_COOKIE_NAME, "", {
    ...getAccessCookieOptions(),
    maxAge: 0,
  });
  return res;
}
