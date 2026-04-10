import type { ReactNode } from "react";
import { PortfolioSidebar } from "./PortfolioSidebar";

export const metadata = {
  title: "Portfolio | 坂本知也",
  description: "革新的な体験をデザインと技術で実現",
};

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PortfolioSidebar />
      <main className="ml-20 flex-1">{children}</main>
    </div>
  );
}
