import { auth } from "@/auth";
import { ACCESS_COOKIE_NAME } from "@/lib/access-auth";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

/** アクセス保護の対象外パス（共通パスワード不要で通す） */
function isAccessExempt(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/access")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname === "/logo.png") return true;
  if (pathname.startsWith("/images/")) return true;
  if (/\.(png|ico|svg|jpg|jpeg|gif|webp|woff2?)$/i.test(pathname)) return true;
  return false;
}

/** 共通パスワード認証済みか（Cookie の有無のみ。署名検証は API で実施） */
function hasAccessCookie(req: NextRequest): boolean {
  return req.cookies.get(ACCESS_COOKIE_NAME)?.value === "1";
}

const withNextAuth = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
  const isLandingOrDashboard =
    req.nextUrl.pathname === "/" || req.nextUrl.pathname === "/dashboard";
  if (!isLoggedIn && !isAuthPage && !isLandingOrDashboard) {
    return Response.redirect(new URL("/", req.url));
  }
  return undefined;
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // 1) 共通パスワード（アクセス保護）: 未認証なら /login へ
  if (!isAccessExempt(req.nextUrl.pathname)) {
    const accessPassword = process.env.ACCESS_PASSWORD?.trim() ?? "";

    if (process.env.NODE_ENV === "production" && !accessPassword) {
      return NextResponse.redirect(new URL("/login?unconfigured=1", req.url));
    }
    if (accessPassword && !hasAccessCookie(req)) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return (withNextAuth as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response | undefined>)(
    req,
    event
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)"],
};
