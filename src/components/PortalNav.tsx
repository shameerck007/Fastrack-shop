"use client";

import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

export interface PortalNavItem {
  href: string;
  /** Translated through the dictionary... */
  labelKey?: string;
  /** ...or shown as-is (for areas that are English only). */
  label?: string;
  icon: string;
}

/** Side navigation on desktop, a swipeable pill row on phones. `rootHref` is only
 * active on an exact match (otherwise it would light up for every sub-page). */
export default function PortalNav({ items, rootHref }: { items: PortalNavItem[]; rootHref: string }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = item.href === rootHref ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition md:rounded-xl md:py-2.5 ${
              active
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-blue-50 hover:text-blue-700 md:bg-transparent md:ring-0"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${active ? "bg-white/20" : "bg-neutral-100 md:bg-white md:shadow-sm md:ring-1 md:ring-neutral-200"}`}
            >
              {item.icon}
            </span>
            {item.label ?? t(item.labelKey ?? "")}
          </Link>
        );
      })}
    </nav>
  );
}
