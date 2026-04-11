import Image from "next/image";
import Link from "next/link";

const customerFeatures = [
  "メニュー選択",
  "人数選択",
  "空き日時表示",
  "予約登録",
  "予約確認",
  "キャンセル",
  "予約確認通知",
  "リマインド通知",
] as const;

const staffFeatures = [
  "今日の予約一覧",
  "日付別予約一覧",
  "予約詳細確認",
  "来店済み／キャンセル／無断キャンセル管理",
  "メニュー管理",
  "営業日・営業時間設定",
  "通知設定",
] as const;

const reservationFlow = [
  "顧客がメニューを選ぶ",
  "顧客が人数を選ぶ",
  "システムが空いている日付と時間を表示する",
  "顧客が日時を選ぶ",
  "顧客情報を入力する",
  "予約を確定する",
  "予約確認通知を送る",
  "予約日が近づいたらリマインド通知を送る",
] as const;

const mvpItems = [
  "メニュー一覧表示",
  "人数選択",
  "空き日時表示",
  "予約登録",
  "予約完了メール",
  "管理画面での予約一覧表示",
  "キャンセル機能",
  "前日通知",
] as const;

const securityPrinciples = [
  "個人情報は必要最小限のみ取得・表示・保存",
  "管理画面は認証必須、権限に応じて表示制御",
  "ログやレスポンスに不要な個人情報を含めない",
  "SQLインジェクション / XSS / CSRF / レート制限を前提実装",
] as const;

const menuCards = [
  {
    id: "menu_lunch_set",
    name: "ランチセット",
    desc: "フレンチの定番ランチを短時間で楽しめるプラン",
    duration: "60分",
    price: "2,200円",
    image: "/images/restaurant/menu-lunch.png?v=3",
  },
  {
    id: "menu_dinner_course",
    name: "ディナーコース",
    desc: "ゆっくり食事を楽しむ定番コース",
    duration: "90分",
    price: "4,800円",
    image: "/images/restaurant/menu-dinner.png?v=3",
  },
  {
    id: "menu_anniversary",
    name: "記念日コース",
    desc: "特別な日に向けたフルコース",
    duration: "120分",
    price: "8,000円",
    image: "/images/restaurant/menu-anniversary.png?v=3",
  },
] as const;

export default function RestaurantReservationPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] md:text-3xl">
          レストラン予約システム
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)] md:text-base">
          メニュー選択後に空き日時を案内して予約できる仕組みと、予約確認通知・リマインド通知、
          店舗側の予約管理を一体化したシステムです。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/restaurant-reservation/availability"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] no-underline hover:opacity-90"
          >
            空き日時を確認
          </Link>
          <Link
            href="/restaurant-reservation/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-[var(--border)]"
          >
            今すぐ予約する
          </Link>
          <Link
            href="/restaurant-reservation/cancel"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--foreground)]"
          >
            キャンセル確認
          </Link>
          <Link
            href="/restaurant-reservation/admin"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--foreground)]"
          >
            予約一覧（管理）
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">メニュー（画像付き）</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {menuCards.map((menu) => (
            <article
              key={menu.name}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]"
            >
              <div className="flex w-full justify-center bg-[color-mix(in_srgb,var(--border)_35%,transparent)]">
                <Image
                  src={menu.image}
                  alt={menu.name}
                  width={1200}
                  height={800}
                  className="h-auto w-full max-w-full object-contain"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  priority={menu.name === "ランチセット"}
                  unoptimized
                />
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-base font-semibold text-[var(--foreground)]">{menu.name}</h3>
                <p className="text-sm text-[var(--muted)]">{menu.desc}</p>
                <p className="text-sm text-[var(--muted)]">所要時間: {menu.duration}</p>
                <p className="text-sm font-medium text-[var(--foreground)]">価格: {menu.price}</p>
                <Link
                  href={`/restaurant-reservation/booking?menuId=${encodeURIComponent(menu.id)}`}
                  className="mt-1 inline-flex min-h-[42px] w-full items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] no-underline transition-opacity hover:opacity-90"
                >
                  このコースで予約
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">顧客向け機能</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {customerFeatures.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">店舗向け機能</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {staffFeatures.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">想定する予約フロー</h2>
        <ol className="mt-3 space-y-2 text-sm text-[var(--muted)] md:text-base">
          {reservationFlow.map((step, idx) => (
            <li key={step}>
              {idx + 1}. {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">MVP 範囲</h2>
          <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {mvpItems.map((item, idx) => (
              <li key={item}>
                {idx + 1}. {item}
              </li>
            ))}
          </ol>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">セキュリティ方針</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {securityPrinciples.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">関連ドキュメント</h2>
        <p className="mt-3">- `requirements.md`</p>
        <p>- `security.md`</p>
        <p>- `docs/reservation-overview.md`</p>
        <p>- `docs/reservation-rules.md`</p>
        <p>- `docs/database-design.md`</p>
      </section>
    </main>
  );
}
