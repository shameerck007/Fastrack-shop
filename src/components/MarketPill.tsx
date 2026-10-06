"use client";

import { useState, useTransition } from "react";
import { setMarket } from "@/lib/actions/tenant";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";

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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (tenants.length < 2) return null;
  const current = tenants.find((t) => t.id === currentId) ?? tenants[0];
  const flag = findCountry(current.country_code);

  function choose(id: string) {
    if (id === currentId) return;
    setError(null);
    startTransition(async () => {
      const res = await setMarket(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <details className="group relative shrink-0">
      <summary
        aria-label="Change country"
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-semibold [&::-webkit-details-marker]:hidden ${
          variant === "header"
            ? "bg-blue-50 px-2.5 py-1.5 text-blue-800 hover:bg-blue-100"
            : "border border-blue-200 bg-white px-3.5 py-1.5 text-neutral-700 hover:bg-blue-50"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span className="text-base leading-none">{flag.flag}</span>
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
              disabled={pending}
              onClick={() => choose(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-semibold disabled:opacity-60 ${
                active ? "bg-blue-50 text-blue-700" : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span className="text-lg">{c.flag}</span>
              <span className="flex-1">
                {c.name}
                <span className="block text-[11px] font-normal text-neutral-400">{t.currency}</span>
              </span>
              {active && <span>✓</span>}
            </button>
          );
        })}
        {error && <p className="px-3 py-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </details>
  );
}
