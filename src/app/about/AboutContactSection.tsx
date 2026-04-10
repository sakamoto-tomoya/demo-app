/**
 * 連絡先URLは .env.local などで設定:
 * NEXT_PUBLIC_ABOUT_CONTACT_EMAIL / NEXT_PUBLIC_ABOUT_SNS_X / _INSTAGRAM / _LINKEDIN / _FACEBOOK / _LINE
 */
import type { ReactElement, SVGProps } from "react";

function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function IconLinkedIn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconFacebook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/** Simple Icons の LINE（緑ロゴ） */
function IconLine(props: SVGProps<SVGSVGElement>) {
  return (
    <img
      src="/images/about/line-icon.svg"
      alt=""
      width={24}
      height={24}
      className={props.className}
      aria-hidden
    />
  );
}

type SocialItem = { href: string; label: string; Icon: (p: SVGProps<SVGSVGElement>) => ReactElement };

function buildSocialItems(): SocialItem[] {
  const items: SocialItem[] = [];
  const x = process.env.NEXT_PUBLIC_ABOUT_SNS_X?.trim();
  const ig = process.env.NEXT_PUBLIC_ABOUT_SNS_INSTAGRAM?.trim();
  const li = process.env.NEXT_PUBLIC_ABOUT_SNS_LINKEDIN?.trim();
  const fb = process.env.NEXT_PUBLIC_ABOUT_SNS_FACEBOOK?.trim();
  const line = process.env.NEXT_PUBLIC_ABOUT_SNS_LINE?.trim();
  if (x) items.push({ href: x, label: "X", Icon: IconX });
  if (line) items.push({ href: line, label: "LINE", Icon: IconLine });
  if (ig) items.push({ href: ig, label: "Instagram", Icon: IconInstagram });
  if (li) items.push({ href: li, label: "LinkedIn", Icon: IconLinkedIn });
  if (fb) items.push({ href: fb, label: "Facebook", Icon: IconFacebook });
  return items;
}

export function AboutContactSection() {
  const email = process.env.NEXT_PUBLIC_ABOUT_CONTACT_EMAIL?.trim();
  const socialItems = buildSocialItems();
  const hasLinks = Boolean(email) || socialItems.length > 0;

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 px-5 py-8 text-center shadow-[var(--shadow-sm)] backdrop-blur-sm md:px-10 md:py-10"
      aria-labelledby="about-contact-heading"
    >
      <h2 id="about-contact-heading" className="sr-only">
        お問い合わせ・SNS
      </h2>
      <p className="text-base leading-relaxed text-[var(--foreground)] md:text-lg">
        主に企業様向けに業務改善の支援を行っております。
      </p>
      <p className="mt-3 text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
        お仕事のご相談はDMへお気軽にどうぞ
      </p>
      {hasLinks && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--foreground)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              aria-label={`メールで連絡（${email}）`}
              title={email}
            >
              <IconMail className="h-6 w-6" />
            </a>
          ) : null}
          {socialItems.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--foreground)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              aria-label={`${label}で開く`}
            >
              <Icon className="h-6 w-6" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
