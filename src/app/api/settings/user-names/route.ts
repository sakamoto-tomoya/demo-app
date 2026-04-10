import { loadSettingsUsers } from "@/lib/settings-users";
import { NextResponse } from "next/server";

/**
 * 担当者ドロップダウン用に、ユーザー・担当者登録の「名前」一覧だけを返す。
 * 認証不要（名前のみのため）。案件フォームの担当者選択で利用。
 */
export async function GET() {
  const users = loadSettingsUsers();
  const names = users.map((u) => u.name?.trim()).filter(Boolean);
  const unique = Array.from(new Set(names));
  return NextResponse.json({ names: unique });
}
