"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isMainContentGatedPath, useWebAppSubmenu } from "@/components/WebAppSubmenuContext";

/**
 * サブメニューが閉じている（矢印が上向き）とき、業務ルートの main 中身を描画しない
 */
export function MainContentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { submenuOpen } = useWebAppSubmenu();

  const gated = isMainContentGatedPath(pathname);
  const hide = gated && !submenuOpen;

  if (hide) {
    return null;
  }

  return <>{children}</>;
}
