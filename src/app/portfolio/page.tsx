import Link from "next/link";

export default function PortfolioHome() {
  return (
    <section
      className="relative flex min-h-screen flex-col items-start justify-center overflow-hidden px-16 text-white lg:px-24"
      style={{
        background: "linear-gradient(160deg, #06040f 0%, #090618 30%, #0b0820 60%, #08061a 100%)",
      }}
    >
      {/* Aurora background layers */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* Glow 1: Bottom-left purple */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 90% 60% at 5% 70%, rgba(109,40,217,0.28) 0%, transparent 55%)",
          }}
        />
        {/* Glow 2: Top-right indigo */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 95% 20%, rgba(67,56,202,0.32) 0%, transparent 55%)",
          }}
        />
        {/* Glow 3: Bottom-center cyan */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 100% 40% at 50% 100%, rgba(30,58,138,0.22) 0%, transparent 50%)",
          }}
        />

        {/* Wave lines SVG */}
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

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-3xl">
        {/* Main heading */}
        <h1 className="text-5xl font-bold leading-[1.2] tracking-tight md:text-6xl lg:text-7xl">
          <span className="block text-white drop-shadow-[0_2px_20px_rgba(109,40,217,0.4)]">
            革新的な体験を
          </span>
          <span
            className="block"
            style={{
              background: "linear-gradient(90deg, #22d3ee 0%, #a78bfa 45%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            デザインと技術で実現
          </span>
        </h1>

        {/* Description */}
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
          最先端の技術とクリエイティブな発想で、
          ビジネスを加速させるWebアプリケーションを開発します
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/portfolio/projects"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white no-underline transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
              boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
            }}
          >
            プロジェクトを見る
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/portfolio/contact"
            className="inline-flex items-center rounded-xl border border-white/20 bg-transparent px-8 py-4 text-base font-semibold text-white/90 no-underline transition-all hover:border-white/30 hover:bg-white/[0.08] hover:scale-[1.02] active:scale-[0.98]"
          >
            お問い合わせ
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30" aria-hidden>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="34"
          viewBox="0 0 22 34"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="1" width="20" height="32" rx="10" />
          <circle cx="11" cy="9" r="2.5" fill="currentColor" stroke="none">
            <animate attributeName="cy" values="9;18;9" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* Help button */}
      <button
        className="absolute bottom-7 right-7 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[13px] font-medium text-white/40 transition hover:bg-white/[0.1] hover:text-white/70"
        aria-label="ヘルプ"
        type="button"
      >
        ?
      </button>
    </section>
  );
}
