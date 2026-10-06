"use client";

import { useState } from "react";
import MarketSwitchDialog from "@/components/MarketSwitchDialog";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";
import Flag from "@/components/Flag";

/** Order history is kept per country. This points to the other country's orders and offers the switch. */
export default function OtherMarketOrdersNote({
  tenants,
  currentId,
  others,
}: {
  tenants: Tenant[];
  currentId: string;
  others: { countryCode: string; count: number }[];
}) {
  const [target, setTarget] = useState<Tenant | null>(null);
  const current = tenants.find((t) => t.id === currentId) ?? null;
  if (others.length === 0 || !current) return null;

  return (
    <div className="mb-4 space-y-2">
      {others.map((o) => {
        const country = findCountry(o.countryCode);
        const tenant = tenants.find((t) => t.country_code === o.countryCode) ?? null;
        return (
          <div key={o.countryCode} className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <Flag code={o.countryCode} className="h-6 w-8" />
            <span className="min-w-0 flex-1 text-sm text-blue-950">
              <b>
                {o.count} order{o.count === 1 ? "" : "s"}
              </b>{" "}
              in {country.name}
              <span className="block text-xs text-blue-900/70">Orders are kept separately for each country.</span>
            </span>
            {tenant && (
              <button
                type="button"
                onClick={() => setTarget(tenant)}
                className="rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                View in {country.name}
              </button>
            )}
          </div>
        );
      })}
      <MarketSwitchDialog open={!!target} target={target} current={current} onClose={() => setTarget(null)} />
    </div>
  );
}
