"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type WebAppSubmenuContextValue = {
  /** true = サブメニュー表示・矢印は下向き（閉じる操作） */
  submenuOpen: boolean;
  setSubmenuOpen: (open: boolean) => void;
  toggleSubmenu: () => void;
};

const WebAppSubmenuContext = createContext<WebAppSubmenuContextValue | null>(null);

export function WebAppSubmenuProvider({ children }: { children: ReactNode }) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const toggleSubmenu = useCallback(() => setSubmenuOpen((v) => !v), []);
  const value = useMemo(
    () => ({ submenuOpen, setSubmenuOpen, toggleSubmenu }),
    [submenuOpen, toggleSubmenu]
  );
  return <WebAppSubmenuContext.Provider value={value}>{children}</WebAppSubmenuContext.Provider>;
}

export function useWebAppSubmenu() {
  const ctx = useContext(WebAppSubmenuContext);
  if (!ctx) {
    throw new Error("useWebAppSubmenu must be used within WebAppSubmenuProvider");
  }
  return ctx;
}

/** WEB開発のサブメニューから辿る画面（閉じているときは中身を出さない） */
export function isMainContentGatedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const p = pathname.split("?")[0].replace(/\/$/, "") || "/";
  /** トップ・自己紹介は矢印の開閉に関係なく常に表示 */
  if (p === "/" || p === "/about" || p.startsWith("/login")) return false;
  if (p.startsWith("/cases")) return true;
  if (p === "/dashboard") return true;
  if (p === "/calendar") return true;
  if (p === "/history") return true;
  if (p.startsWith("/parts")) return true;
  if (p.startsWith("/expense")) return true;
  if (p.startsWith("/settings")) return true;
  return false;
}
