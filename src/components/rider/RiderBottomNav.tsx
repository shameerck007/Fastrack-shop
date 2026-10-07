"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";

const ITEMS = [
  { href: "/rider", label: "Home", icon: "🏠", exact: true },
  { href: "/rider/earnings", label: "Earnings", icon: "💰" },
  { href: "/rider/history", label: "Trips", icon: "🧾" },
  { href: "/account", label: "Account", icon: "👤" },
];

// App-style tab bar for the rider portal (phones only; the header carries the same links on wider screens).
export default function RiderBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-neutral-100 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.06)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${active ? "text-blue-700" : "text-neutral-500"}`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full text-lg leading-none ${active ? "bg-blue-100" : ""}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
