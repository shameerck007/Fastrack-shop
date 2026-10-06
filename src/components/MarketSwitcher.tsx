"use client";

import { useState, useTransition } from "react";
import { setMarket } from "@/lib/actions/tenant";
import { findCountry } from "@/lib/countries";
import { useLocale } from "@/components/LocaleProvider";
import type { Tenant } from "@/lib/tenant";

/** "Shopping in 🇸🇦 Saudi Arabia — change": lets a customer move between markets. */
export default function MarketSwitcher({ tenants, currentId }: { tenants: Tenant[]; currentId: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tenants.length < 2) return null;

  function choose(id: string) {
    if (id === currentId) return;
    setError(null);
    startTransition(async () => {
      const res = await setMarket(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Cart, currency, delivery zones and header all depend on the market: start the page fresh.
      window.location.reload();
    });
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
              disabled={pending}
              onClick={() => choose(tenant.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-start transition disabled:opacity-60 ${
                active ? "border-blue-600 bg-blue-50" : "border-neutral-300 hover:border-blue-300"
              }`}
            >
              <span className="text-2xl">{country.flag}</span>
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
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
