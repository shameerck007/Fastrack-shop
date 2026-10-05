"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "🏠", exact: true },
  { href: "/cart", label: "Cart", icon: "🛒" },
  { href: "/orders", label: "Orders", icon: "📦" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { signedIn, cartCount } = useCustomerHeaderState();

  const accountItem: NavItem = signedIn
    ? { href: "/account", label: "Account", icon: "👤" }
    : { href: "/login", label: "Login", icon: "👤" };

  const items = [...ITEMS, accountItem];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-neutral-100 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.06)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
                isActive ? "text-blue-700" : "text-neutral-500"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full text-lg leading-none transition ${
                  isActive ? "bg-blue-100" : ""
                }`}
              >
                {item.icon}
              </span>
              {item.label}
              {item.href === "/cart" && cartCount > 0 && (
                <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
