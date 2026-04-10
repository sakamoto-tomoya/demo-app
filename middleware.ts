import { auth } from "@/auth";
import { NextResponse } from "next/server";

const withNextAuth = auth(() => {
  return NextResponse.next();
});

export default withNextAuth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)"],
};
