"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/cases/new", label: "新規受付登録" },
  { href: "/", label: "全体進捗状況" },
  { href: "/map", label: "全依頼案件MAP" },
  { href: "/calendar", label: "担当者別スケジュール" },
  { href: "/history", label: "履歴検索" },
];

const linkClass = (pathname: string, href: string) =>
  `block rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center ${
    pathname === href
      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
      : "text-[var(--foreground)] hover:bg-[var(--background)] active:opacity-80"
  }`;

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const partsLinkActive = pathname === "/parts" || (pathname.startsWith("/parts/") && pathname !== "/parts/month-end");

  const navContent = (
    <>
      <Link
        href="/"
        onClick={() => setMenuOpen(false)}
        className="mb-4 block w-full text-[var(--primary)] no-underline"
      >
        <img
          src="/logo.png?v=4"
          alt="GasLink 依頼と現場をつなぐ"
          className="max-h-24 w-full object-contain object-left"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "block";
          }}
        />
        <span className="hidden text-lg font-semibold" style={{ display: "none" }}>GasLink</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} onClick={() => setMenuOpen(false)} className={linkClass(pathname, href)}>
              {label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/parts"
            onClick={() => setMenuOpen(false)}
            className={`block w-full rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center ${
              partsLinkActive
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--foreground)] hover:bg-[var(--background)] active:opacity-80"
            }`}
          >
            部品管理
          </Link>
        </li>
        <li>
          <Link
            href="/parts/month-end"
            onClick={() => setMenuOpen(false)}
            className={linkClass(pathname, "/parts/month-end")}
          >
            月末処理
          </Link>
        </li>
        <li>
          <a
            href={process.env.NEXT_PUBLIC_SALESFORCE_URL ?? "https://login.salesforce.com"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center text-[var(--foreground)] hover:bg-[var(--background)] active:opacity-80"
          >
            Salesforceに移動
          </a>
        </li>
        <li>
          <Link
            href="/expense"
            onClick={() => setMenuOpen(false)}
            className={linkClass(pathname, "/expense")}
          >
            経費精算
          </Link>
        </li>
      </ul>
      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">各種設定</p>
        <ul className="flex flex-col gap-1">
          <li>
            <Link href="/settings" onClick={() => setMenuOpen(false)} className={linkClass(pathname, "/settings")}>
              設定
            </Link>
          </li>
        </ul>
      </div>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <a
          href="/api/auth/access/logout"
          onClick={() => setMenuOpen(false)}
          className="block rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] active:opacity-80"
        >
          アクセス解除
        </a>
        <Link
          href="/api/auth/signout"
          onClick={() => setMenuOpen(false)}
          className="block rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium no-underline transition-colors min-h-[44px] flex items-center text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] active:opacity-80"
        >
          ログアウト
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* スマホ: 画面上部のヘッダー（印刷時は非表示） */}
      <header className="no-print fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-xl px-4 md:hidden">
        <Link href="/" className="flex items-center text-[var(--primary)] no-underline">
          <img
            src="/logo.png?v=4"
            alt="GasLink"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "inline";
            }}
          />
          <span className="hidden text-lg font-semibold" style={{ display: "none" }}>GasLink</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius)] text-[var(--foreground)] hover:bg-[var(--background)] active:opacity-80"
          aria-label="メニューを開く"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </header>

      {/* スマホ: ドロワー開いているときのオーバーレイ */}
      {menuOpen && (
        <button
          type="button"
          className="no-print fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="メニューを閉じる"
        />
      )}

      {/* スマホ: ドロワー / PC: 常時表示サイドバー（印刷時は非表示） */}
      <nav
        className={`
          no-print flex w-52 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] p-5
          md:relative md:z-0 md:flex md:w-56
          max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50 max-md:h-full max-md:w-72 max-md:shadow-xl
          ${menuOpen ? "max-md:flex" : "max-md:hidden"}
        `}
      >
        {/* スマホドロワー内: 閉じるボタン */}
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="text-lg font-semibold text-[var(--foreground)]">メニュー</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius)] text-[var(--foreground)] hover:bg-[var(--background)]"
            aria-label="メニューを閉じる"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {navContent}
      </nav>
    </>
  );
}
