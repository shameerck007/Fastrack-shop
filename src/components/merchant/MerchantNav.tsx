"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/merchant", label: "Dashboard", icon: "📊" },
  { href: "/merchant/products", label: "Products & Stock", icon: "📦" },
  { href: "/merchant/orders", label: "Orders", icon: "🧾" },
];

export default function MerchantNav() {
  const pathname = usePathname();

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
            {item.label}
          </Link>
        );
      })}
      <div className="my-2 border-t border-neutral-200" />
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <span>←</span>
        Back to shop
      </Link>
    </nav>
  );
}
