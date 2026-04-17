"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isMainContentGatedPath, useWebAppSubmenu } from "@/components/WebAppSubmenuContext";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";

/**
 * サブメニューが閉じている（矢印が上向き）とき、業務ルートの main 中身を描画しない
 */
export function MainContentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { submenuOpen } = useWebAppSubmenu();

  const gated = isMainContentGatedPath(pathname);
  const hide = gated && !submenuOpen;

  if (hide) {
    return (
      <div className="-mx-4 -mt-14 flex flex-1 flex-col md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
        <WorkflowDiagram />
      </div>
    );
  }

  return <>{children}</>;
}
