import { auth } from "@/auth";
import {
  loadSettingsUsers,
  addSettingsUser,
  deleteSettingsUser,
  updateSettingsUser,
  type SettingsUserRecord,
} from "@/lib/settings-users";
import { requireSettingsAuth } from "@/lib/settings-auth";
import { requireAccessAuth } from "@/lib/access-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const MAX_NAME = 100;
const MAX_EMAIL = 256;
const MAX_PASSWORD = 200;

/** 一覧用：パスワードを本人または管理者以外には返さない */
export type SettingsUserListItem = Omit<SettingsUserRecord, "password"> & {
  password: string | null;
};

function maskPasswords(
  users: SettingsUserRecord[],
  viewerEmail: string | null,
  viewerName: string | null,
  isAdmin: boolean
): SettingsUserListItem[] {
  return users.map((u) => {
    const isSelf =
      (viewerEmail && u.email.toLowerCase() === viewerEmail.toLowerCase()) ||
      (viewerName && u.name.trim() === viewerName.trim());
    const showPassword = isAdmin || isSelf;
    return {
      ...u,
      password: showPassword ? u.password : null,
    };
  });
}

/** 閲覧者が設定ユーザー一覧で管理者かどうか */
function isViewerAdmin(
  users: SettingsUserRecord[],
  viewerEmail: string | null,
  viewerName: string | null
): boolean {
  if (!viewerEmail && !viewerName) return false;
  const u = users.find(
    (x) =>
      (viewerEmail && x.email.toLowerCase() === viewerEmail.toLowerCase()) ||
      (viewerName && x.name.trim() === viewerName.trim())
  );
  return !!u?.admin;
}

/** 一覧取得（パスワードは本人または管理者のみ表示） */
export async function GET(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await auth();
  const viewerEmail = (session?.user?.email as string) ?? null;
  const viewerName = (session?.user?.name as string) ?? null;
  const users = loadSettingsUsers();
  const isAdmin = isViewerAdmin(users, viewerEmail, viewerName);
  const list = maskPasswords(users, viewerEmail, viewerName, isAdmin);
  return NextResponse.json({ list, viewerIsAdmin: isAdmin });
}

/** 新規ユーザー追加 */
export async function POST(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode) {
    return NextResponse.json({ error: "デモモードでは登録・変更・削除できません" }, { status: 403 });
  }
  let body: {
    name?: string;
    email?: string;
    password?: string;
    admin?: boolean;
    reception?: boolean;
    field?: boolean;
    inbound?: boolean;
    outbound?: boolean;
    accounting?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();
  if (!name || !email) {
    return NextResponse.json({ error: "名前とメールアドレスは必須です" }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: `名前は${MAX_NAME}文字以内にしてください` }, { status: 400 });
  }
  if (email.length > MAX_EMAIL) {
    return NextResponse.json({ error: `メールアドレスは${MAX_EMAIL}文字以内にしてください` }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "パスワードは必須です" }, { status: 400 });
  }
  if (password.length > MAX_PASSWORD) {
    return NextResponse.json({ error: `パスワードは${MAX_PASSWORD}文字以内にしてください` }, { status: 400 });
  }
  const users = loadSettingsUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }
  try {
    addSettingsUser({
      name,
      email,
      password,
      admin: !!body?.admin,
      reception: !!body?.reception,
      field: !!body?.field,
      inbound: !!body?.inbound,
      outbound: !!body?.outbound,
      accounting: !!body?.accounting,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/users POST]", err instanceof Error ? err.message : "error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "登録に失敗しました" },
      { status: 500 }
    );
  }
}

/** 役割のみ更新（管理者のみ） */
export async function PATCH(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode) {
    return NextResponse.json({ error: "デモモードでは登録・変更・削除できません" }, { status: 403 });
  }
  const session = await auth();
  const viewerEmail = (session?.user?.email as string) ?? null;
  const viewerName = (session?.user?.name as string) ?? null;
  const users = loadSettingsUsers();
  if (!isViewerAdmin(users, viewerEmail, viewerName)) {
    return NextResponse.json({ error: "管理者のみ変更できます" }, { status: 403 });
  }
  let body: {
    id?: string;
    admin?: boolean;
    reception?: boolean;
    field?: boolean;
    inbound?: boolean;
    outbound?: boolean;
    accounting?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }
  const updated = updateSettingsUser(id, {
    admin: !!body?.admin,
    reception: !!body?.reception,
    field: !!body?.field,
    inbound: !!body?.inbound,
    outbound: !!body?.outbound,
    accounting: !!body?.accounting,
  });
  if (!updated) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** 削除（管理者のみ） */
export async function DELETE(request: NextRequest) {
  const accessErr = await requireAccessAuth();
  if (accessErr) return accessErr;
  const rate = checkRateLimit(request);
  if (rate) return rate;
  if (!(await requireSettingsAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode) {
    return NextResponse.json({ error: "デモモードでは登録・変更・削除できません" }, { status: 403 });
  }
  const session = await auth();
  const viewerEmail = (session?.user?.email as string) ?? null;
  const viewerName = (session?.user?.name as string) ?? null;
  const users = loadSettingsUsers();
  if (!isViewerAdmin(users, viewerEmail, viewerName)) {
    return NextResponse.json({ error: "管理者のみ削除できます" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }
  const deleted = deleteSettingsUser(id);
  if (!deleted) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
