import type { ReactNode } from "react";
import FileAnalyzer from "@/components/FileAnalyzer";

/** AppShell の横パディングを打ち消し、メイン列の幅いっぱい（左右パディングなし＝背景まで端まで） */
const bleedFullWidth =
  "-mx-4 w-[calc(100%+2rem)] max-w-none md:-mx-8 md:w-[calc(100%+4rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]";

/**
 * ワークフロー表示エリアの最小高さ（上段セル）
 */
const workflowHeroMinHeightClass = "min-h-[min(72vh,52rem)]";

/** public/ 直下の mp4（左: FAQ 系・右: 占い系） */
const VIDEO_LEFT_SRC = "/ai-chat-left.mp4";
const VIDEO_RIGHT_SRC = "/ai-chat-right.mp4";

/**
 * ベース背景の上に重ねる画像（最大2枚）。
 */
type BackgroundOverlay = {
  src: string;
  opacityClass?: string;
  imgClass?: string;
};

const overlayImgIntenseClass =
  "contrast-[1.65] saturate-[1.2] brightness-[0.66]";

const overlayPanelInnerClass =
  "box-border flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-[3px] border-white bg-white p-1.5 shadow-[0_4px_28px_rgba(0,0,0,0.14)] sm:p-2 dark:shadow-[0_4px_28px_rgba(0,0,0,0.35)]";

const overlayImgLayoutClass =
  "block min-h-0 w-full flex-1 object-contain object-center";

const BACKGROUND_OVERLAY_IMAGES: readonly BackgroundOverlay[] = [
  {
    src: "/chat-bg-accent-2.png",
    opacityClass: "opacity-100 dark:opacity-100",
    imgClass: overlayImgIntenseClass,
  },
  {
    src: "/chat-bg-accent-1.png",
    opacityClass: "opacity-100 dark:opacity-100",
    imgClass: overlayImgIntenseClass,
  },
];

const portfolioTags = ["Dify", "Workflow", "LLM", "FAQ / RAG"] as const;

const portfolioTitleClass =
  "text-left text-xl font-bold leading-snug tracking-tight text-[var(--foreground)]";

const portfolioBodyTextClass =
  "text-left text-sm leading-[1.6] text-[color-mix(in_srgb,var(--foreground)_78%,var(--muted))] dark:text-[color-mix(in_srgb,var(--foreground)_82%,var(--muted))]";
const portfolioBodyFirstClass = `mt-2 ${portfolioBodyTextClass}`;
const portfolioBodyNextClass = `mt-1 ${portfolioBodyTextClass}`;

function PortfolioCaptionTags({ listClassName }: { listClassName: string }) {
  return (
    <ul className={listClassName} aria-label="使用技術">
      {portfolioTags.map((tag) => (
        <li key={tag}>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)]/90 px-2 py-0.5 text-[0.6875rem] font-medium leading-tight text-[var(--foreground)] shadow-[var(--shadow-sm)] backdrop-blur-sm">
            {tag}
          </span>
        </li>
      ))}
    </ul>
  );
}

const workflowCaptionCardSurface =
  "pointer-events-auto absolute z-[12] w-max max-w-[min(32rem,calc(100vw-2rem))] min-w-0 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/95 p-4 shadow-[var(--shadow)] backdrop-blur-sm";

const defaultBodyFirst =
  "Dify を用いた FAQ チャットボットのワークフロー構成案。";
const defaultBodySecond = "業務問い合わせの一次対応を想定したデモです。";

function WorkflowCaptionCardContent({
  title,
  bodyFirstLine,
  bodySecondLine,
}: {
  title: string;
  bodyFirstLine?: string;
  bodySecondLine?: string | null;
}) {
  const first = bodyFirstLine ?? defaultBodyFirst;
  const second =
    bodySecondLine === undefined ? defaultBodySecond : bodySecondLine;

  return (
    <>
      <h1 className={portfolioTitleClass}>{title}</h1>
      <p className={`${portfolioBodyFirstClass} whitespace-nowrap`}>{first}</p>
      {second != null && second !== "" && (
        <p className={portfolioBodyNextClass}>{second}</p>
      )}
      <PortfolioCaptionTags listClassName="mt-3 flex flex-wrap gap-1" />
    </>
  );
}

function WorkflowCaptionCard({
  positionClassName,
  ariaHidden,
  title = "チャットbot開発",
  bodyFirstLine,
  bodySecondLine,
}: {
  positionClassName: string;
  ariaHidden?: boolean;
  title?: string;
  bodyFirstLine?: string;
  bodySecondLine?: string | null;
}) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={`${workflowCaptionCardSurface} ${positionClassName}`}
    >
      <WorkflowCaptionCardContent
        title={title}
        bodyFirstLine={bodyFirstLine}
        bodySecondLine={bodySecondLine}
      />
    </div>
  );
}

function WorkflowPanelCell({
  overlay,
  children,
}: {
  overlay: BackgroundOverlay;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-[var(--border)] ${workflowHeroMinHeightClass}`}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[url('/chat-bg.png')] bg-no-repeat opacity-[0.58] dark:opacity-[0.65]"
        aria-hidden
        style={{
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-[var(--background)]/55 via-[var(--background)]/42 to-[var(--background)]/62 dark:from-[var(--background)]/62 dark:via-[var(--background)]/48 dark:to-[var(--background)]/70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.42] dark:opacity-[0.32]"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 25%, rgba(0, 113, 227, 0.12), transparent 55%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[5] flex flex-col p-2 sm:p-3"
        aria-hidden
      >
        <div
          className={`flex min-h-0 flex-1 flex-col ${overlayPanelInnerClass} ${overlay.opacityClass ?? "opacity-95 dark:opacity-90"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ユーザー配置の任意比率画像 */}
          <img
            src={overlay.src}
            alt=""
            className={`${overlayImgLayoutClass} ${overlay.imgClass ?? ""}`}
            draggable={false}
          />
        </div>
      </div>

      {children}
    </div>
  );
}

function PortfolioVideoCell({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-sm)]">
      <div className="aspect-video w-full bg-black/5 dark:bg-black/30">
        <video
          className="h-full w-full object-contain"
          controls
          playsInline
          preload="auto"
          src={src}
          title={title}
          aria-label={title}
        >
          お使いのブラウザは動画の再生に対応していません。
        </video>
      </div>
    </div>
  );
}

/**
 * ナビ「チャットbot開発」— ポートフォリオ掲載用のビジュアルページ
 */
export default function AiChatPage() {
  const overlays = BACKGROUND_OVERLAY_IMAGES.filter((o) => o.src.trim() !== "");
  const left = overlays[0];
  const right = overlays[1];

  return (
    <div className={`flex flex-col gap-3 ${bleedFullWidth}`}>
      {/* 上段: 左右ワークフロー */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
        {left && (
          <WorkflowPanelCell overlay={left}>
            <WorkflowCaptionCard positionClassName="left-[88%] top-[78%] -translate-x-1/2 -translate-y-1/2" />
          </WorkflowPanelCell>
        )}
        {right && (
          <WorkflowPanelCell overlay={right}>
            <WorkflowCaptionCard
              ariaHidden
              title="占いチャットbot開発"
              bodyFirstLine="Difyを用いた占い師様向けのbotを開発。"
              bodySecondLine={null}
              positionClassName="bottom-24 right-8 sm:bottom-28 sm:right-12"
            />
          </WorkflowPanelCell>
        )}
      </section>

      {/* 下段: 左右動画（赤枠イメージ） */}
      <section
        className="grid grid-cols-1 gap-3 border-b border-[var(--border)] pb-3 sm:grid-cols-2 sm:gap-3 sm:pb-4"
        aria-label="デモ動画"
      >
        <PortfolioVideoCell
          src={VIDEO_LEFT_SRC}
          title="FAQ チャットボットワークフロー紹介動画"
        />
        <PortfolioVideoCell
          src={VIDEO_RIGHT_SRC}
          title="占いチャットボット紹介動画"
        />
      </section>
    </div>
  );
}
