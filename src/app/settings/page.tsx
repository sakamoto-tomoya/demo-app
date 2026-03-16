"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, defaultSettings, type Settings } from "@/lib/settings";

const inputClass =
  "mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

export default function SettingsPage() {
  const [authStatus, setAuthStatus] = useState<"loading" | "unauthenticated" | "unconfigured" | "authenticated">("loading");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [settingsUsers, setSettingsUsers] = useState<
    { id: string; name: string; email: string; password: string | null; admin: boolean; reception: boolean; field: boolean; inbound: boolean; outbound: boolean; accounting: boolean }[]
  >([]);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [detailUser, setDetailUser] = useState<typeof settingsUsers[0] | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailEditRoles, setDetailEditRoles] = useState({
    admin: false,
    reception: false,
    field: false,
    inbound: false,
    outbound: false,
    accounting: false,
  });
  const [detailSaveLoading, setDetailSaveLoading] = useState(false);
  const [detailSaveError, setDetailSaveError] = useState("");
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    admin: false,
    reception: false,
    field: false,
    inbound: false,
    outbound: false,
    accounting: false,
  });
  const [userFormError, setUserFormError] = useState("");
  const [userFormLoading, setUserFormLoading] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      fetch("/api/auth/settings")
        .then(async (res) => {
          if (res.ok) {
            setAuthStatus("authenticated");
            return;
          }
          const data = await res.json().catch(() => ({}));
          if (res.status === 401 && data?.unconfigured) {
            setAuthStatus("unconfigured");
            return;
          }
          setAuthStatus("unauthenticated");
        })
        .catch(() => setAuthStatus("unauthenticated"));
    };
    checkAuth();
  }, []);

  const fetchSettingsUsers = useCallback(() => {
    fetch("/api/settings/users")
      .then((res) => res.json())
      .then((data: { list?: typeof settingsUsers; viewerIsAdmin?: boolean }) => {
        setSettingsUsers(Array.isArray(data?.list) ? data.list : []);
        setViewerIsAdmin(!!data?.viewerIsAdmin);
      })
      .catch(() => setSettingsUsers([]));
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      setSettings(loadSettings());
      fetchSettingsUsers();
    }
  }, [authStatus, fetchSettingsUsers]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    fetch("/api/auth/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    })
      .then((res) => {
        if (res.ok) {
          setAuthStatus("authenticated");
          setPasswordInput("");
        } else {
          setPasswordError(true);
        }
      })
      .catch(() => setPasswordError(true));
  };

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-[var(--muted)]">
        確認中…
      </div>
    );
  }

  if (authStatus === "unconfigured") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">各種設定</h1>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--alert-bg)] p-4 text-sm text-[var(--alert)]">
          デモ用表示です。SETTINGS_PASSWORD が未設定のため変更はできません。画面構成の参考として表示しています。
        </div>
        <p className="text-[var(--muted)]">
          各種設定を登録できます。（本番では管理者パスワードを設定すると利用可能になります）
        </p>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
            ユーザー・担当者登録
          </h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            名前・メールアドレス・パスワードと担当を登録します。管理者・受付・現場・入庫・出庫・経理などの役割を割り当てられます。
          </p>
          <p className="rounded bg-[var(--background)] p-4 text-sm text-[var(--muted)]">
            （デモではユーザー一覧は表示しません。本番で SETTINGS_PASSWORD を設定すると利用できます）
          </p>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
            メール設定
          </h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            入庫通知などで使用するSMTP設定を登録します。
          </p>
          <p className="rounded bg-[var(--background)] p-4 text-sm text-[var(--muted)]">
            （デモでは表示・変更はできません）
          </p>
        </section>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">設定</h1>
        <p className="text-[var(--muted)]">
          管理者用パスワードを入力してください。
        </p>
        <form onSubmit={handlePasswordSubmit} className="max-w-xs space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">パスワード</span>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className={inputClass}
              placeholder="管理者パスワード"
              autoFocus
            />
          </label>
          {passwordError && (
            <p className="text-sm text-red-600">パスワードが正しくありません。</p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            送信
          </button>
        </form>
      </div>
    );
  }

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUserFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError("");
    setUserFormLoading(true);
    fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        admin: userForm.admin,
        reception: userForm.reception,
        field: userForm.field,
        inbound: userForm.inbound,
        outbound: userForm.outbound,
        accounting: userForm.accounting,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setUserForm({ name: "", email: "", password: "", admin: false, reception: false, field: false, inbound: false, outbound: false, accounting: false });
          fetchSettingsUsers();
        } else {
          setUserFormError(data?.error ?? "登録に失敗しました");
        }
      })
      .catch(() => setUserFormError("通信エラー"))
      .finally(() => setUserFormLoading(false));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        各種設定
      </h1>
      <p className="text-[var(--muted)]">
        各種設定を登録できます。
      </p>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          ユーザー・担当者登録
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          名前・メールアドレス・パスワードと担当を登録します。パスワードは登録した本人と管理者のみ表示されます。Googleでログインした状態で開くと本人のパスワードが表示され、管理者として登録した場合は全てのパスワードを確認できます。
        </p>
        <form onSubmit={handleUserFormSubmit} className="mb-6 grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">名前</span>
            <input
              type="text"
              value={userForm.name}
              onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
              placeholder="氏名"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">メールアドレス</span>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
              className={inputClass}
              placeholder="example@example.com"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">パスワード</span>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
              className={inputClass}
              placeholder="パスワード"
              required
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.admin}
                onChange={(e) => setUserForm((p) => ({ ...p, admin: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">管理者</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.reception}
                onChange={(e) => setUserForm((p) => ({ ...p, reception: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">受付担当</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.field}
                onChange={(e) => setUserForm((p) => ({ ...p, field: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">現場処理担当</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.inbound}
                onChange={(e) => setUserForm((p) => ({ ...p, inbound: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">入庫担当</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.outbound}
                onChange={(e) => setUserForm((p) => ({ ...p, outbound: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">出庫担当</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={userForm.accounting}
                onChange={(e) => setUserForm((p) => ({ ...p, accounting: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm text-[var(--foreground)]">経理担当</span>
            </label>
          </div>
          {userFormError && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{userFormError}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={userFormLoading}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {userFormLoading ? "登録中…" : "登録"}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--foreground)]">名前</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--foreground)]">詳細</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--foreground)]">メールアドレス</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--foreground)]">パスワード</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">管理者</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">受付担当</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">現場処理</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">入庫担当</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">出庫担当</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">経理担当</th>
                <th className="px-3 py-2 text-center font-medium text-[var(--foreground)]">削除</th>
              </tr>
            </thead>
            <tbody>
              {settingsUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center text-[var(--muted)]">
                    登録がありません
                  </td>
                </tr>
              ) : (
                settingsUsers.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{u.name}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailUser(u);
                          setDetailEditing(false);
                          setDetailEditRoles({
                            admin: u.admin,
                            reception: u.reception,
                            field: u.field,
                            inbound: u.inbound,
                            outbound: u.outbound,
                            accounting: (u as { accounting?: boolean }).accounting ?? false,
                          });
                          setDetailSaveError("");
                        }}
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                      >
                        詳細
                      </button>
                    </td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.password != null ? u.password : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">{u.admin ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{u.reception ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{u.field ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{u.inbound ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{u.outbound ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{(u as { accounting?: boolean }).accounting ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`${u.name} を削除してもよろしいですか？`)) {
                            fetch(`/api/settings/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" })
                              .then((res) => {
                                if (res.ok) {
                                  if (detailUser?.id === u.id) setDetailUser(null);
                                  fetchSettingsUsers();
                                }
                              })
                              .catch(() => {});
                          }
                        }}
                        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {detailUser && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setDetailUser(null);
                setDetailEditing(false);
                setDetailSaveError("");
              }}
              aria-label="閉じる"
            />
            <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">ユーザー詳細</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-[var(--muted)]">名前</dt>
                  <dd className="text-[var(--foreground)]">{detailUser.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">メールアドレス</dt>
                  <dd className="text-[var(--foreground)]">{detailUser.email}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">パスワード</dt>
                  <dd className="font-mono text-[var(--foreground)]">
                    {viewerIsAdmin || detailUser.password != null
                      ? detailUser.password
                      : "管理者のみパスワードを確認できます"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">担当</dt>
                  <dd className="flex flex-wrap gap-2 text-[var(--foreground)]">
                    {!detailEditing ? (
                      <>
                        {detailUser.admin && <span className="rounded bg-[var(--border)] px-2 py-0.5">管理者</span>}
                        {detailUser.reception && <span className="rounded bg-[var(--border)] px-2 py-0.5">受付担当</span>}
                        {detailUser.field && <span className="rounded bg-[var(--border)] px-2 py-0.5">現場処理担当</span>}
                        {detailUser.inbound && <span className="rounded bg-[var(--border)] px-2 py-0.5">入庫担当</span>}
                        {detailUser.outbound && <span className="rounded bg-[var(--border)] px-2 py-0.5">出庫担当</span>}
                        {(detailUser as { accounting?: boolean }).accounting && <span className="rounded bg-[var(--border)] px-2 py-0.5">経理担当</span>}
                        {!detailUser.admin && !detailUser.reception && !detailUser.field && !detailUser.inbound && !detailUser.outbound && !(detailUser as { accounting?: boolean }).accounting && (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.admin}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, admin: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>管理者</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.reception}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, reception: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>受付担当</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.field}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, field: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>現場処理担当</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.inbound}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, inbound: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>入庫担当</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.outbound}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, outbound: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>出庫担当</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailEditRoles.accounting}
                            onChange={(e) => setDetailEditRoles((p) => ({ ...p, accounting: e.target.checked }))}
                            className="h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span>経理担当</span>
                        </label>
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
              {detailSaveError && <p className="mt-2 text-sm text-red-600">{detailSaveError}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {viewerIsAdmin && !detailEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailEditing(true);
                      setDetailEditRoles({
                        admin: detailUser.admin,
                        reception: detailUser.reception,
                        field: detailUser.field,
                        inbound: detailUser.inbound,
                        outbound: detailUser.outbound,
                        accounting: (detailUser as { accounting?: boolean }).accounting ?? false,
                      });
                      setDetailSaveError("");
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                  >
                    変更
                  </button>
                )}
                {viewerIsAdmin && detailEditing && (
                  <button
                    type="button"
                    disabled={detailSaveLoading}
                    onClick={() => {
                      setDetailSaveError("");
                      setDetailSaveLoading(true);
                      fetch("/api/settings/users", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: detailUser.id,
                          admin: detailEditRoles.admin,
                          reception: detailEditRoles.reception,
                          field: detailEditRoles.field,
                          inbound: detailEditRoles.inbound,
                          outbound: detailEditRoles.outbound,
                          accounting: detailEditRoles.accounting,
                        }),
                      })
                        .then(async (res) => {
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            fetchSettingsUsers();
                            const updated = data as typeof detailUser;
                            setDetailUser((prev) => (prev ? { ...prev, ...updated } : null));
                            setDetailEditing(false);
                          } else {
                            setDetailSaveError(data?.error ?? "保存に失敗しました");
                          }
                        })
                        .catch(() => setDetailSaveError("通信エラー"))
                        .finally(() => setDetailSaveLoading(false));
                    }}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                  >
                    {detailSaveLoading ? "保存中…" : "保存"}
                  </button>
                )}
                {detailEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailEditing(false);
                      setDetailEditRoles({
                        admin: detailUser.admin,
                        reception: detailUser.reception,
                        field: detailUser.field,
                        inbound: detailUser.inbound,
                        outbound: detailUser.outbound,
                        accounting: detailUser.accounting,
                      });
                      setDetailSaveError("");
                    }}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                  >
                    キャンセル
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDetailUser(null);
                    setDetailEditing(false);
                    setDetailSaveError("");
                  }}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
        >
          保存する
        </button>
        {saved && (
          <span className="text-sm text-[var(--muted)]">保存しました</span>
        )}
      </div>
    </div>
  );
}
