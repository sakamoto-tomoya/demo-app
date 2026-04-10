import Link from "next/link";
import HomeChat from "@/components/HomeChat";

export default function Home() {
  return (
    <section
      className="
        relative -mx-4 -mt-14 flex w-[calc(100%+2rem)] flex-col items-center justify-center overflow-hidden text-white
        md:-mx-8 md:-mt-8 md:w-[calc(100%+4rem)]
        lg:-mx-10 lg:-mt-10 lg:w-[calc(100%+5rem)]
      "
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #06040f 0%, #090618 30%, #0b0820 60%, #08061a 100%)",
      }}
    >
      {/* ── オーロラ背景レイヤー ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* グロー1: 左下パープル */}
        <div
          className="aurora-layer absolute"
          style={{
            inset: 0,
            background:
              "radial-gradient(ellipse 90% 60% at 5% 70%, rgba(109,40,217,0.28) 0%, transparent 55%)",
          }}
        />
        {/* グロー2: 右上インディゴ */}
        <div
          className="aurora-layer-slow absolute"
          style={{
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 95% 20%, rgba(67,56,202,0.32) 0%, transparent 55%)",
          }}
        />
        {/* グロー3: 中央下シアン */}
        <div
          className="aurora-layer absolute"
          style={{
            inset: 0,
            background:
              "radial-gradient(ellipse 100% 40% at 50% 100%, rgba(30,58,138,0.22) 0%, transparent 50%)",
          }}
        />

        {/* 波ライン SVG */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.18]"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <path
              key={i}
              d={`M-100 ${80 + i * 80} Q 360 ${50 + i * 80} 720 ${90 + i * 80} Q 1080 ${130 + i * 80} 1540 ${80 + i * 80}`}
              stroke={i % 2 === 0 ? "#7c3aed" : "#4f46e5"}
              strokeWidth="1"
              fill="none"
              opacity={Math.max(0.08, 0.32 - i * 0.025)}
            />
          ))}
        </svg>

        {/* グリッドパターン（極薄） */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="relative z-10 flex flex-col items-center gap-7 px-6 py-20 text-center md:py-24">
        {/* メイン見出し */}
        <h1 className="text-[clamp(1.6rem,4vw,2.8rem)] font-bold leading-[1.4] tracking-tight">
          <span className="fade-up fade-up-delay-1 block text-white drop-shadow-[0_2px_20px_rgba(109,40,217,0.4)]">
            現場の"非効率"を、AIで仕組みに変える。
          </span>
          <span
            className="fade-up fade-up-delay-2 block"
            style={{
              background: "linear-gradient(90deg, #22d3ee 0%, #a78bfa 45%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            業務改善に特化したWebアプリとAI導入で、
            <br />
            "人に依存しない業務フロー"を実現します。
          </span>
        </h1>

        {/* 説明テキスト */}
        <p className="fade-up fade-up-delay-3 max-w-[520px] text-[15px] leading-relaxed text-white/55 md:text-base">
          現場課題をもとに、<br className="hidden sm:block" />
          AIとWebで業務フローを最適化します。
        </p>

        {/* CTAボタン */}
        <div className="fade-up fade-up-delay-4 mt-1 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/about"
            className="inline-flex items-center rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3 text-[15px] font-semibold text-white no-underline backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:scale-[1.02] active:scale-[0.98]"
          >
            お問い合わせ
          </Link>
          <HomeChat />
        </div>

        {/* ソーシャルアイコン */}
        <div className="mt-2 flex items-center gap-5 text-white/40">
          {/* GitHub */}
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white/75"
            aria-label="GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
          {/* LinkedIn */}
          <a
            href="https://linkedin.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white/75"
            aria-label="LinkedIn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </a>
          {/* Email */}
          <a
            href="/about"
            className="transition hover:text-white/75"
            aria-label="メール"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </a>
        </div>
      </div>

      {/* ── スクロールインジケーター ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="34" viewBox="0 0 22 34" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="20" height="32" rx="10" />
          <circle cx="11" cy="9" r="2.5" fill="currentColor" stroke="none">
            <animate attributeName="cy" values="9;18;9" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

    </section>
  );
}
