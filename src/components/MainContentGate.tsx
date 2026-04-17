"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { isMainContentGatedPath, useWebAppSubmenu } from "@/components/WebAppSubmenuContext";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";

export function MainContentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { submenuOpen, setSubmenuOpen } = useWebAppSubmenu();

  const gated = isMainContentGatedPath(pathname);
  const hide = gated && !submenuOpen;

  if (hide) {
    return (
      <div className="-mx-4 -mt-14 flex flex-1 flex-col md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
        <WorkflowDiagram />
      </div>
    );
  }

  const showBackButton = gated && submenuOpen && pathname !== "/dashboard";

  return (
    <>
      {showBackButton && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSubmenuOpen(false);
              router.push("/dashboard");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:bg-[var(--muted)]/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            業務管理TOPへ戻る
          </button>
        </div>
      )}
      {children}
    </>
  );
}
