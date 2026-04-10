import type { SettingsUserRecord } from "@/lib/settings-users";

/** 設定ユーザー一覧から、セッション（Google のメール・表示名）に一致するユーザーを探す */
export function findSettingsUserBySession(
  users: SettingsUserRecord[],
  viewerEmail: string | null,
  viewerName: string | null
): SettingsUserRecord | null {
  if (!viewerEmail && !viewerName) return null;
  return (
    users.find(
      (x) =>
        (viewerEmail && x.email.toLowerCase() === viewerEmail.toLowerCase()) ||
        (viewerName && x.name.trim() === viewerName.trim())
    ) ?? null
  );
}

/**
 * 訪問効率提案の表示権限
 * ① 管理者・受付担当 → 全担当者の案件を対象にできる
 * ② 現場処理担当 → 自分の担当のみ
 * ③ 入庫・出庫・経理のみ（①②に該当しない）→ 非表示
 */
export type VisitEfficiencyAccess =
  | { kind: "hidden" }
  | { kind: "all" }
  | { kind: "self"; viewerName: string };

export function getVisitEfficiencyAccess(u: SettingsUserRecord | null): VisitEfficiencyAccess {
  if (!u) return { kind: "hidden" };
  if (u.admin || u.reception) return { kind: "all" };
  if (u.field) {
    const name = (u.name ?? "").trim();
    return { kind: "self", viewerName: name || "未割当" };
  }
  if (u.inbound || u.outbound || u.accounting) return { kind: "hidden" };
  return { kind: "hidden" };
}

export function isVisitEfficiencyAllowed(access: VisitEfficiencyAccess): boolean {
  return access.kind !== "hidden";
}

/** 担当者名の比較用（カレンダー表示と同様） */
export function normalizeAssigneeName(v: string | undefined | null): string {
  return (v ?? "").replace(/\s+/g, "").trim();
}
