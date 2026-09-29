"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

const NAV = [
  { href: "/warehouse/orders", labelKey: "warehouse.orders_nav", icon: "🧾" },
  { href: "/warehouse/stock", labelKey: "warehouse.stock_nav", icon: "📦" },
];

export default function WarehouseNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
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
