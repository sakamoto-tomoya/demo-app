"use client";

import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import { MainContentGate } from "@/components/MainContentGate";
import { WebAppSubmenuProvider } from "@/components/WebAppSubmenuContext";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WebAppSubmenuProvider>
      <div className="flex min-h-screen">
        <Nav />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-8 pt-14 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
          <div className="flex min-h-0 flex-1 flex-col">
            <MainContentGate>{children}</MainContentGate>
          </div>
        </main>
      </div>
    </WebAppSubmenuProvider>
  );
}
