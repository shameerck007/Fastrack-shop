"use client";

import { useState, useTransition } from "react";
import { dismissMarketSuggestion, setMarket } from "@/lib/actions/tenant";
import { findCountry } from "@/lib/countries";
import { MARKET_TOAST_KEY } from "@/components/MarketSwitchDialog";
import { useLocale } from "@/components/LocaleProvider";
import type { Tenant } from "@/lib/tenant";

/** First visit from another country: "You seem to be in India — shop FasTrack India?" The visitor decides. */
export default function MarketSuggestionBanner({ suggested }: { suggested: Tenant }) {
  const { t } = useLocale();
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;
  const country = findCountry(suggested.country_code);

  return (
    <div className="border-b border-blue-100 bg-blue-50 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="min-w-0 flex-1 text-blue-900">
          <span className="me-1.5 text-lg">{country.flag}</span>
          {t("market.suggest", { country: country.name })}
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setMarket(suggested.id);
                if (!res.error) {
                  try {
                    sessionStorage.setItem(MARKET_TOAST_KEY, JSON.stringify({ flag: country.flag, name: country.name }));
                  } catch {}
                  setHidden(true);
                  window.location.reload();
                }
              })
            }
            className="rounded-full bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {t("market.switch")}
          </button>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              dismissMarketSuggestion();
            }}
            className="rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            {t("market.stay")}
          </button>
        </span>
      </div>
    </div>
  );
}
