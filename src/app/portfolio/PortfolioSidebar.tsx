"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/portfolio", label: "Home", icon: "home" },
  { href: "/portfolio/about", label: "About", icon: "user" },
  { href: "/portfolio/projects", label: "Project", icon: "folder" },
  { href: "/portfolio/contact", label: "Contact", icon: "mail" },
] as const;

function NavIcon({ name, className }: { name: string; className?: string }) {
  const props = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    default:
      return null;
  }
}

export function PortfolioSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col items-center border-r border-white/[0.08] py-8"
      style={{ backgroundColor: "#0a0818" }}
    >
      {/* P Logo */}
      <Link
        href="/portfolio"
        className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold text-white no-underline"
        style={{
          background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
          boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
        }}
      >
        P
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-4">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 no-underline"
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    }
                  : {}
              }
              aria-label={label}
              title={label}
            >
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute left-0 h-6 w-[3px] rounded-r-sm"
                  style={{ backgroundColor: "#a78bfa" }}
                />
              )}
              <NavIcon
                name={icon}
                className={
                  isActive
                    ? "text-white"
                    : "text-white/60 transition-colors group-hover:text-white/90"
                }
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
