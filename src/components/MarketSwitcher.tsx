"use client";

import { useState } from "react";
import MarketSwitchDialog from "@/components/MarketSwitchDialog";
import { findCountry } from "@/lib/countries";
import { useLocale } from "@/components/LocaleProvider";
import type { Tenant } from "@/lib/tenant";
import Flag from "@/components/Flag";

/** "Shopping in 🇸🇦 Saudi Arabia — change": lets a customer move between markets. */
export default function MarketSwitcher({ tenants, currentId }: { tenants: Tenant[]; currentId: string }) {
  const { t } = useLocale();

  if (tenants.length < 2) return null;

  const [target, setTarget] = useState<Tenant | null>(null);
  const current = tenants.find((x) => x.id === currentId) ?? null;

  function choose(id: string) {
    if (id === currentId) return;
    setTarget(tenants.find((x) => x.id === id) ?? null);
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl">🌍</span>
        <span className="flex flex-col">
          <span className="font-medium text-neutral-900">{t("market.title")}</span>
          <span className="text-sm text-neutral-500">{t("market.desc")}</span>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tenants.map((tenant) => {
          const country = findCountry(tenant.country_code);
          const active = tenant.id === currentId;
          return (
            <button
              key={tenant.id}
              type="button"
              onClick={() => choose(tenant.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
                active ? "border-blue-600 bg-blue-50" : "border-neutral-300 hover:border-blue-300"
              }`}
            >
              <Flag code={tenant.country_code} className="h-6 w-8" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">{country.name}</span>
                <span className="block text-xs text-neutral-500">{tenant.currency}</span>
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  active ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300"
                }`}
              >
                {active ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <MarketSwitchDialog open={!!target} target={target} current={current} onClose={() => setTarget(null)} />
    </div>
  );
}
