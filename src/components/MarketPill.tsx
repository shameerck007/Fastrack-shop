"use client";

import { useRef, useState } from "react";
import MarketSwitchDialog from "@/components/MarketSwitchDialog";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";
import Flag from "@/components/Flag";

/** Country switch for everyone, signed in or not: a flag in the header (and footer) with a small menu.
 * Choosing a country reloads the shop in that market (its stores, prices, currency and cart). */
export default function MarketPill({
  tenants,
  currentId,
  variant = "header",
}: {
  tenants: Tenant[];
  currentId: string;
  variant?: "header" | "footer";
}) {
  const [target, setTarget] = useState<Tenant | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  if (tenants.length < 2) return null;
  const current = tenants.find((t) => t.id === currentId) ?? tenants[0];
  const flag = findCountry(current.country_code);

  function choose(t: Tenant) {
    if (t.id === currentId) return;
    if (menu.current) menu.current.open = false;
    setTarget(t);
  }

  return (
    <>
    <details ref={menu} className="group relative shrink-0">
      <summary
        aria-label="Change country"
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-semibold [&::-webkit-details-marker]:hidden ${
          variant === "header"
            ? "bg-blue-50 px-2.5 py-1.5 text-blue-800 hover:bg-blue-100"
            : "border border-blue-200 bg-white px-3.5 py-1.5 text-neutral-700 hover:bg-blue-50"
        }`}
      >
        <Flag code={current.country_code} className="h-4 w-[22px]" />
        <span className={variant === "header" ? "hidden lg:inline" : ""}>{flag.name}</span>
        <span className="text-[9px] opacity-60 transition group-open:rotate-180">▼</span>
      </summary>
      <div
        className={`absolute end-0 z-50 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl ${
          variant === "footer" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Shop in</p>
        {tenants.map((t) => {
          const c = findCountry(t.country_code);
          const active = t.id === currentId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-semibold ${
                active ? "bg-blue-50 text-blue-700" : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <Flag code={t.country_code} className="h-[18px] w-6" />
              <span className="flex-1">
                {c.name}
                <span className="block text-[11px] font-normal text-neutral-400">{t.currency}</span>
              </span>
              {active && <span>✓</span>}
            </button>
          );
        })}
      </div>
    </details>
    <MarketSwitchDialog open={!!target} target={target} current={current} onClose={() => setTarget(null)} />
    </>
  );
}
