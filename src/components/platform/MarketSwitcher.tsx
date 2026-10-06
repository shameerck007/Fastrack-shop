"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findCountry } from "@/lib/countries";

export interface SwitcherMarket {
  slug: string;
  country_code: string;
  status: string;
}

/** Country selector in the platform header. Everything below it shows only the chosen country. */
export default function MarketSwitcher({ markets, current }: { markets: SwitcherMarket[]; current: string }) {
  const pathname = usePathname() || "/platform";
  const parts = pathname.split("/");
  const code = parts[2] && parts[2] !== "markets" ? parts[2].toLowerCase() : "";
  const cur = markets.find((m) => m.country_code.toLowerCase() === code) ?? (code ? undefined : markets.find((m) => m.slug === current)) ?? markets[0];
  if (!cur) return null;
  const hrefFor = (cc: string) => (code ? ["", "platform", cc, ...parts.slice(3)].join("/") : `/platform/${cc}`);
  const c = findCountry(cur.country_code);
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 [&::-webkit-details-marker]:hidden">
        <span className="text-base">{c.flag}</span>
        <span>{c.name}</span>
        <span className="text-[10px] transition group-open:rotate-180">▼</span>
      </summary>
      <div className="absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl">
        <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Viewing country</p>
        {markets.map((m) => {
          const mc = findCountry(m.country_code);
          const active = m.slug === cur.slug;
          return (
            <Link
              key={m.slug}
              href={hrefFor(m.country_code.toLowerCase())}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-blue-50 text-blue-700" : "text-neutral-700 hover:bg-neutral-50"}`}
            >
              <span className="text-lg">{mc.flag}</span>
              <span className="flex-1">{mc.name}</span>
              {m.status !== "active" && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">{m.status}</span>}
              {active && <span>✓</span>}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
