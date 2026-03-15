import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** ログイン中のユーザー情報を返す（出庫担当者制限などに利用） */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  });
}
