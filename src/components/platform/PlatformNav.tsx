"use client";

import Link from "@/components/Link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
  icon: string;
  /** Opens one of the existing market-admin screens (for the market you are viewing). */
  external?: boolean;
  /** Not tied to a country (the address is used as written). */
  fixed?: boolean;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Platform",
    items: [
      { href: "", label: "Overview", icon: "📊" },
      { href: "/platform/markets", label: "Markets", fixed: true, icon: "🌍" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/sales", label: "Sales", icon: "💰" },
      { href: "/suppliers", label: "Suppliers", icon: "🏪" },
      { href: "/riders", label: "Riders", icon: "🛵" },
      { href: "/customers", label: "Customers", icon: "👥" },
    ],
  },
  {
    title: "Run a market",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "🧾", external: true },
      { href: "/admin/products", label: "Products", icon: "📦", external: true },
      { href: "/admin/settlements", label: "Supplier settlements", icon: "📒", external: true },
      { href: "/admin/rider-settlements", label: "Rider settlements", icon: "💵", external: true },
      { href: "/admin/zones", label: "Delivery zones", icon: "📍", external: true },
      { href: "/admin/settings", label: "Business settings", icon: "⚙️", external: true },
    ],
  },
];

export default function PlatformNav() {
  const pathname = usePathname() || "";
  const seg = pathname.split("/")[2] ?? "";
  const country = seg && seg !== "markets" ? seg : "";
  const link = (item: Item) => (item.external || item.fixed ? item.href : country ? `/platform/${country}${item.href}` : "/platform");
  const isActive = (item: Item) => {
    const href = link(item);
    if (item.external) return false;
    return item.href === "" ? pathname === href : pathname.startsWith(href);
  };

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:overflow-visible md:rounded-3xl md:border md:border-neutral-200 md:bg-white md:p-3 md:pb-3 md:shadow-sm [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((section, si) => (
        <div key={section.title} className={`flex gap-2 md:block ${si === 2 ? "max-md:hidden" : ""}`}>
          <p className="hidden px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 first:pt-1 md:block">{section.title}</p>
          <div className="flex gap-2 md:flex-col md:gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  href={link(item)}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition md:rounded-xl md:py-2.5 ${
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-blue-50 hover:text-blue-700 md:bg-transparent md:ring-0"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${active ? "bg-white/20" : "bg-neutral-100"}`}>{item.icon}</span>
                  {item.label}
                  {item.external && <span className="ms-auto hidden text-xs text-neutral-300 md:inline">↗</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
