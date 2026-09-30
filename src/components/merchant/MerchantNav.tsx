"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

const NAV = [
  { href: "/merchant", labelKey: "portal.dashboard", icon: "📊" },
  { href: "/merchant/orders", labelKey: "merchant.orders_nav", icon: "🧾" },
  { href: "/merchant/products", labelKey: "merchant.products_stock", icon: "📦" },
  { href: "/merchant/settlements", labelKey: "merchant.settlement_ledger", icon: "📒" },
];

export default function MerchantNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === "/merchant" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-blue-50 text-blue-700" : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            <span>{item.icon}</span>
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
