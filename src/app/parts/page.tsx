import Link from "next/link";

const menuItems = [
  { href: "/parts/inbound", label: "入庫" },
  { href: "/parts/outbound", label: "出庫" },
  { href: "/parts/stock-search", label: "在庫検索" },
  { href: "/parts/inventory", label: "棚卸" },
];

export default function PartsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        部品管理
      </h1>
      <p className="text-[var(--muted)]">
        下記の項目を管理します。
      </p>
      <ul className="flex flex-col gap-2">
        {menuItems.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-sm font-medium text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--border)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
