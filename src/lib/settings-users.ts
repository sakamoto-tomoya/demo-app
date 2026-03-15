import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "settings-users.json");

export type SettingsUserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  admin: boolean;
  reception: boolean;
  field: boolean;
  inbound: boolean;
  outbound: boolean;
  /** 経理担当（銀行設定の操作可） */
  accounting: boolean;
};

function loadRaw(): SettingsUserRecord[] {
  try {
    if (!existsSync(USERS_FILE)) return [];
    const raw = readFileSync(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (u: unknown): u is Record<string, unknown> =>
          u != null &&
          typeof u === "object" &&
          typeof (u as SettingsUserRecord).id === "string" &&
          typeof (u as SettingsUserRecord).name === "string" &&
          typeof (u as SettingsUserRecord).email === "string"
      )
      .map((u) => ({
        ...u,
        password: typeof u.password === "string" ? u.password : "",
        admin: !!u.admin,
        reception: !!u.reception,
        field: !!u.field,
        inbound: !!u.inbound,
        outbound: !!u.outbound,
        accounting: !!u.accounting,
      })) as SettingsUserRecord[];
  } catch {
    return [];
  }
}

function saveRaw(users: SettingsUserRecord[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

/** 設定ユーザー一覧を取得 */
export function loadSettingsUsers(): SettingsUserRecord[] {
  return loadRaw();
}

/** 設定ユーザーを1件追加 */
export function addSettingsUser(user: {
  name: string;
  email: string;
  password: string;
  admin: boolean;
  reception: boolean;
  field: boolean;
  inbound: boolean;
  outbound: boolean;
  accounting?: boolean;
}): SettingsUserRecord {
  const users = loadRaw();
  const normalized: SettingsUserRecord = {
    id: randomUUID(),
    name: String(user.name ?? "").trim(),
    email: String(user.email ?? "").trim().toLowerCase(),
    password: String(user.password ?? ""),
    admin: !!user.admin,
    reception: !!user.reception,
    field: !!user.field,
    inbound: !!user.inbound,
    outbound: !!user.outbound,
    accounting: !!user.accounting,
  };
  users.push(normalized);
  saveRaw(users);
  return normalized;
}

/** 設定ユーザーを1件更新（役割のみ。パスワードは変更しない） */
export function updateSettingsUser(
  id: string,
  roles: { admin: boolean; reception: boolean; field: boolean; inbound: boolean; outbound: boolean; accounting?: boolean }
): SettingsUserRecord | null {
  const users = loadRaw();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) return null;
  users[i] = {
    ...users[i],
    admin: !!roles.admin,
    reception: !!roles.reception,
    field: !!roles.field,
    inbound: !!roles.inbound,
    outbound: !!roles.outbound,
    accounting: !!roles.accounting,
  };
  saveRaw(users);
  return users[i];
}

/** 設定ユーザーを1件削除 */
export function deleteSettingsUser(id: string): boolean {
  const users = loadRaw().filter((u) => u.id !== id);
  if (users.length === loadRaw().length) return false;
  saveRaw(users);
  return true;
}
