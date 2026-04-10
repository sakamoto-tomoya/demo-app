import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { loadSettingsUsers } from "@/lib/settings-users";
import {
  findSettingsUserBySession,
  getVisitEfficiencyAccess,
  isVisitEfficiencyAllowed,
} from "@/lib/visit-efficiency-access";

/** ログイン中のユーザー情報を返す（出庫担当者制限・訪問効率提案の表示可否などに利用） */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewerEmail = (session.user.email as string | null | undefined) ?? null;
  const viewerName = (session.user.name as string | null | undefined) ?? null;
  const users = loadSettingsUsers();
  const viewer = findSettingsUserBySession(users, viewerEmail, viewerName);
  const visitAccess = getVisitEfficiencyAccess(viewer);
  return NextResponse.json({
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    visitEfficiencyAllowed: isVisitEfficiencyAllowed(visitAccess),
  });
}
