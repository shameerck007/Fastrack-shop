"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

const NAV = [
  { href: "/admin", labelKey: "portal.dashboard", icon: "📊" },
  { href: "/admin/store", labelKey: "admin.fastrack_stores", icon: "🏬" },
  { href: "/admin/products", labelKey: "admin.products", icon: "📦" },
  { href: "/admin/categories", labelKey: "admin.categories", icon: "🗂️" },
  { href: "/admin/orders", labelKey: "admin.orders", icon: "🧾" },
  { href: "/admin/merchants", labelKey: "admin.merchants", icon: "🏪" },
  { href: "/admin/riders", labelKey: "admin.riders", icon: "🛵" },
  { href: "/admin/settlements", labelKey: "admin.settlement_ledger", icon: "📒" },
  { href: "/admin/zones", labelKey: "admin.delivery_zones", icon: "📍" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
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
