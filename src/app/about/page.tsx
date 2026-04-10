import Link from "next/link";
import { OpenAI, ClaudeCode, Cursor, Dify, Figma } from "@lobehub/icons";
import { AboutContactSection } from "./AboutContactSection";
import { ProfilePhoto } from "./ProfilePhoto";

/** AIツールロゴ（`public/images/about/`） */
const AI_TOOL_LOGOS = [
  { src: "/images/about/openai.svg", label: "ChatGPT" },
  { src: "/images/about/cursor.svg", label: "Cursor" },
  { src: "/images/about/googlecloud.svg", label: "Cloud Code" },
  { src: "/images/about/googlegemini.svg", label: "Gemini" },
] as const;

/**
 * ナビ「自己紹介」用。文言はお好みで差し替えください。
 */
export default function AboutPage() {
  return (
    <main
      className="relative isolate -mx-4 flex min-h-full w-[calc(100%+2rem)] max-w-none flex-1 flex-col overflow-hidden px-4 py-12 text-center sm:px-5 md:-mx-8 md:w-[calc(100%+4rem)] md:py-14 md:px-6 lg:-mx-10 lg:w-[calc(100%+5rem)] lg:px-10"
      style={{ background: "linear-gradient(160deg, #06040f 0%, #090618 30%, #0b0820 60%, #08061a 100%)" }}
    >
      {/* オーロラ背景レイヤー */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* グロー1: 左下パープル */}
        <div
          className="aurora-layer absolute"
          style={{
            inset: 0,
            background: "radial-gradient(ellipse 90% 60% at 5% 70%, rgba(109,40,217,0.28) 0%, transparent 55%)",
          }}
        />
        {/* グロー2: 右上インディゴ */}
        <div
          className="aurora-layer-slow absolute"
          style={{
            inset: 0,
            background: "radial-gradient(ellipse 70% 50% at 95% 20%, rgba(67,56,202,0.32) 0%, transparent 55%)",
          }}
        />
        {/* グロー3: 中央下シアン */}
        <div
          className="aurora-layer absolute"
          style={{
            inset: 0,
            background: "radial-gradient(ellipse 100% 40% at 50% 100%, rgba(30,58,138,0.22) 0%, transparent 50%)",
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
      <div className="relative z-0 mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <div className="space-y-10">
          <div>
            <h1 className="fade-up fade-up-delay-1 text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_20px_rgba(109,40,217,0.4)] md:text-5xl">
              自己紹介
            </h1>
            <p className="mt-8 text-white md:mt-10">
              <span
                className="fade-up fade-up-delay-2 block text-2xl font-bold tracking-wide md:text-3xl lg:text-4xl"
                style={{
                  background: "linear-gradient(90deg, #22d3ee 0%, #a78bfa 45%, #f472b6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                坂本知也｜AI×業務効率化
              </span>
              <span className="fade-up fade-up-delay-3 mt-4 block text-xl font-medium leading-[1.75] text-white/70 md:mt-5 md:text-2xl lg:text-3xl">
                Webアプリの設計・実装と、AIチャットボット（Dify
                等）の組み込みを行っています。
              </span>
            </p>
          </div>
          <div className="fade-up fade-up-delay-4 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-lg backdrop-blur-sm md:p-8 lg:p-10">
            <div className="space-y-5 text-center text-base leading-[1.75] text-white/80 md:text-lg lg:text-xl">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-white md:text-xl">問題</h3>
                <p>現場業務では、受付・案件管理・問い合わせ対応・情報検索が分散し、対応の遅れ、確認漏れ、二重入力、属人化が起こりやすくなっていた。</p>
                <ul className="mx-auto list-disc space-y-2 pl-5 text-left marker:text-[var(--muted)]" style={{width: "fit-content"}}>
                  <li>受付後の対応スピードが遅い</li>
                  <li>必要な情報を探すだけで時間がかかる</li>
                  <li>紙・Excel・口頭管理でミスや漏れが発生する</li>
                  <li>問い合わせ対応が担当者頼みになりやすい</li>
                  <li>現場で使いづらく、システムが定着しない</li>
                </ul>
              </section>
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-white md:text-xl">解決</h3>
                <p>受付・案件管理・OCR・地図・DB・チャットボットを連携することにより解決</p>
                <ul className="mx-auto list-disc space-y-2 pl-5 text-left marker:text-[var(--muted)]" style={{width: "fit-content"}}>
                  <li>受付から対応までの流れをスムーズにできる</li>
                  <li>手入力や確認作業を減らし、作業時間を短縮できる</li>
                  <li>情報を一元化し、確認漏れや伝達ミスを防げる</li>
                  <li>問い合わせ対応を効率化し、対応品質を安定させられる</li>
                  <li>現場で使いやすいUIで、導入後も定着しやすい仕組みにできる</li>
                </ul>
              </section>
            </div>
          </div>
          {/* 使用技術 */}
          <div className="fade-up fade-up-delay-5 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-lg backdrop-blur-sm md:p-8 lg:p-10">
            <h3 className="mb-4 text-lg font-semibold text-white md:text-xl">
              使用技術
            </h3>
            <p className="text-base leading-[1.75] text-white/80 md:text-lg">
              TypeScript、JavaScript、React、Next.js、HTML、CSS、SQL
            </p>
            <p className="mt-3 text-base leading-[1.75] text-white/80 md:text-lg">
              Difyを活用したAIチャットボット構築、OCR・地図・DB連携にも対応
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <ClaudeCode.Avatar size={56} />
              <Cursor.Avatar size={56} />
              <Figma.Avatar size={56} />
              <Dify.Avatar size={56} />
              <OpenAI.Avatar size={56} />
            </div>
          </div>
          <AboutContactSection />
        </div>
        <div className="mt-auto flex justify-center pb-2 pt-10">
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center text-lg font-semibold text-white/60 no-underline transition hover:text-white md:text-xl"
          >
            ← 概要へ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
