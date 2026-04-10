"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isMainContentGatedPath, useWebAppSubmenu } from "@/components/WebAppSubmenuContext";

/** 統合サイトのトップリンク（未設定時は概要 `/`） */
const UNIFIED_HREF =
  process.env.NEXT_PUBLIC_UNIFIED_PORTAL_URL?.trim() || "/";
const UNIFIED_EXTERNAL = /^https?:\/\//i.test(UNIFIED_HREF);

const webAppLinks = [
  { href: "/", label: "概要" },
  { href: "/cases/new", label: "受付登録" },
  { href: "/dashboard", label: "案件管理" },
  { href: "/calendar", label: "担当者別スケジュール" },
  { href: "/history", label: "受付履歴検索" },
];

/** サイドバー上のテキストリンク（非選択） */
const navLinkInactive =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg font-normal text-white/90 no-underline transition-all duration-150 min-h-[52px] hover:bg-white/[0.07] hover:text-white active:opacity-90";

/** 選択中＝パープルグラデ＋縁（globals.css .nav-sidebar-purple-active） */
const navLinkActive =
  "nav-sidebar-purple-active flex w-full items-center gap-3 px-4 py-3 text-lg font-semibold text-white no-underline min-h-[52px]";

const linkClass = (pathname: string, href: string) =>
  pathname === href ? navLinkActive : navLinkInactive;

/* ── アイコン ── */
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function IconPerson() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="8" y1="14.5" x2="16" y2="14.5" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "" : "rotate-180"}`}
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { submenuOpen: webAppNavOpen, setSubmenuOpen, toggleSubmenu } = useWebAppSubmenu();
  const prevSubmenuOpen = useRef(false);

  useEffect(() => {
    if (pathname === "/ai-chat" || pathname.startsWith("/ai-chat/")) {
      setSubmenuOpen(false);
    }
  }, [pathname, setSubmenuOpen]);

  useEffect(() => {
    if (prevSubmenuOpen.current && !webAppNavOpen) {
      if (isMainContentGatedPath(pathname) && pathname !== "/") {
        router.push("/");
      }
    }
    prevSubmenuOpen.current = webAppNavOpen;
  }, [webAppNavOpen, pathname, router]);

  const partsLinkActive = pathname === "/parts" || (pathname.startsWith("/parts/") && pathname !== "/parts/month-end");

  /** プロジェクトメニューがアクティブか（ホーム・About以外） */
  const isProjectActive =
    pathname !== "/" &&
    pathname !== "/about" &&
    pathname !== "/restaurant-reservation" &&
    !pathname.startsWith("/ai-chat");

  const navContent = (
    <div className="flex flex-1 flex-col">
      {/* ── ブランドロゴ ── */}
      <div className="mb-6 flex items-center gap-3 px-1 pt-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
          aria-hidden
        >
          P
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">Portfolio</span>
      </div>

      {/* ── ナビゲーション ── */}
      <nav>
        <ul className="flex flex-col gap-1">
          {/* ホーム */}
          <li>
            <Link href="/" onClick={() => setMenuOpen(false)} className={linkClass(pathname, "/")}>
              <IconHome />
              ホーム
            </Link>
          </li>

          {/* About */}
          <li>
            <Link href="/about" onClick={() => setMenuOpen(false)} className={linkClass(pathname, "/about")}>
              <IconPerson />
              About
            </Link>
          </li>

          {/* プロジェクト（サブメニュートグル） */}
          <li>
            <div
              className={
                isProjectActive
                  ? "nav-sidebar-purple-active flex min-h-[48px] w-full overflow-hidden rounded-xl"
                  : "flex min-h-[48px] w-full items-center overflow-hidden rounded-xl text-white/90"
              }
            >
              <button
                type="button"
                onClick={toggleSubmenu}
                className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-lg no-underline transition-all duration-150 ${
                  isProjectActive
                    ? "font-semibold text-white hover:opacity-95"
                    : "font-normal text-white/90 hover:bg-white/[0.07] hover:text-white active:opacity-90"
                }`}
                aria-expanded={webAppNavOpen}
                aria-controls="nav-project-submenu"
              >
                <IconBriefcase />
                プロジェクト
                <span className="ml-auto">
                  <IconChevron open={webAppNavOpen} />
                </span>
              </button>
            </div>
          </li>

        </ul>

        {/* プロジェクト サブメニュー */}
        {webAppNavOpen && (
          <ul
            id="nav-project-submenu"
            className="mt-2 flex w-full flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-2"
          >
            <li className="px-2 pb-1">
              <p className="text-sm font-medium tracking-wide text-white/70">業務・社内ツール</p>
            </li>
            {webAppLinks.map(({ href, label }) => (
              <li key={`${href}-${label}`}>
                <Link href={href} onClick={() => setMenuOpen(false)}
                  className={`flex w-full items-center rounded-lg px-4 py-3 text-base no-underline whitespace-nowrap transition-all duration-150 ${
                    pathname === href
                      ? "font-semibold text-white bg-white/10"
                      : "font-normal text-white/90 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/parts" onClick={() => setMenuOpen(false)}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-base no-underline whitespace-nowrap transition-all duration-150 ${
                  partsLinkActive
                    ? "font-semibold text-white bg-white/10"
                    : "font-normal text-white/90 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                部品管理
              </Link>
            </li>
            <li>
              <Link href="/parts/month-end" onClick={() => setMenuOpen(false)}
                className={linkClass(pathname, "/parts/month-end").replace("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg", "flex w-full items-center rounded-lg px-4 py-3 text-base").replace("min-h-[48px]", "")}
              >
                月末処理
              </Link>
            </li>
            <li>
              <Link href="/expense" onClick={() => setMenuOpen(false)}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-base no-underline whitespace-nowrap transition-all duration-150 ${
                  pathname === "/expense"
                    ? "font-semibold text-white bg-white/10"
                    : "font-normal text-white/90 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                経費精算
              </Link>
            </li>

            <li className="mt-1 border-t border-white/10 pt-2">
              <p className="mb-1 px-3 text-sm font-medium tracking-wide text-white/70">その他</p>
            </li>
            <li>
              <Link href="/ai-chat" onClick={() => { setMenuOpen(false); setSubmenuOpen(false); }}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-base no-underline whitespace-nowrap transition-all duration-150 ${
                  pathname === "/ai-chat"
                    ? "font-semibold text-white bg-white/10"
                    : "font-normal text-white/90 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                チャットbot開発
              </Link>
            </li>
            <li>
              <Link href="/restaurant-reservation" onClick={() => { setMenuOpen(false); setSubmenuOpen(false); }}
                className={`flex w-full items-center rounded-lg px-4 py-3 text-base no-underline whitespace-nowrap transition-all duration-150 ${
                  pathname === "/restaurant-reservation"
                    ? "font-semibold text-white bg-white/10"
                    : "font-normal text-white/90 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                レストラン予約
              </Link>
            </li>



            <li>
              <Link href="/api/auth/signout" onClick={() => setMenuOpen(false)}
                className="flex w-full items-center rounded-lg px-4 py-3 text-base font-normal text-white/70 no-underline transition-all duration-150 hover:bg-white/[0.06] hover:text-white"
              >
                ログアウト
              </Link>
            </li>
            {UNIFIED_EXTERNAL && (
              <li className="mt-1 border-t border-white/10 pt-2">
                <a href={UNIFIED_HREF} target="_blank" rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center rounded-lg px-4 py-3 text-base font-medium text-amber-200/80 no-underline hover:underline hover:text-amber-100"
                >
                  外部の統合サイトを開く
                </a>
              </li>
            )}
          </ul>
        )}
      </nav>

      {/* ── 相談カード（サイドバー下部） ── */}
      <div className="mt-auto pt-6">
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(109,40,217,0.35) 0%, rgba(49,46,129,0.25) 100%)",
            border: "1px solid rgba(139,92,246,0.25)",
          }}
        >
          <p className="text-base leading-snug text-white/90">
            プロジェクトのご相談は<br />お気軽にどうぞ
          </p>
          <Link
            href="/about"
            onClick={() => setMenuOpen(false)}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-base font-semibold text-white no-underline transition hover:opacity-90"
            style={{
              background: "linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)",
            }}
          >
            お問い合わせ
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* スマホ: 画面上部のヘッダー（印刷時は非表示） */}
      <header className="no-print fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0818]/90 backdrop-blur-xl px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
            aria-hidden
          >
            P
          </div>
          <span className="text-base font-semibold text-white">Portfolio</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/90 hover:bg-white/10 active:opacity-80"
          aria-label="メニューを開く"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          className="no-print fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="メニューを閉じる"
        />
      )}

      {/* スマホ: ドロワー / PC: 常時表示サイドバー（印刷時は非表示） */}
      <nav
        className={`
          no-print flex w-64 shrink-0 flex-col border-r border-white/[0.08] p-5
          md:relative md:z-0 md:flex md:w-[260px]
          max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50 max-md:h-full max-md:w-[22rem] max-md:shadow-2xl
          ${menuOpen ? "max-md:flex" : "max-md:hidden"}
        `}
        style={{ background: "#0a0818" }}
      >
        {/* スマホドロワー内: 閉じるボタン */}
        <div className="mb-4 grid grid-cols-[2.75rem_1fr_2.75rem] items-center md:hidden">
          <div className="w-11 shrink-0" aria-hidden />
          <span className="text-center text-xl font-semibold text-white">メニュー</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-self-end justify-center rounded-xl text-white/90 hover:bg-white/10"
            aria-label="メニューを閉じる"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {navContent}
      </nav>
    </>
  );
}
