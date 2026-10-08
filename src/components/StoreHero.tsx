"use client";

import { useMemo, useState, useEffect } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { StatusPill, StoreCover, StoreLogo, useStatusText } from "@/components/StoreBadge";
import type { StoreInfo } from "@/components/StoreDirectoryProvider";
import { useMarket } from "@/components/MoneyProvider";
import { marketOffsetMinutes } from "@/lib/timezone";
import { DAY_KEYS, formatClock, getOpenStatus, shiftsOf } from "@/lib/store-hours";

const WEEKDAY_ANCHOR = 2; // 2000-01-02 was a Sunday

export default function StoreHero({ store }: { store: StoreInfo }) {
  const { t, locale } = useLocale();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const offset = marketOffsetMinutes(useMarket().countryCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const status = useMemo(() => getOpenStatus(store.opening_hours, store.accepting_orders, new Date(), offset), [store, tick, offset]);
  const statusInfo = useStatusText(status);

  return (
    <section className="bg-neutral-50 pb-2">
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 sm:h-60">
        <StoreCover store={store} emojiSize={88} />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative z-10 -mt-14 rounded-3xl bg-white p-4 shadow-lg ring-1 ring-neutral-100 sm:-mt-16 sm:p-5">
          <div className="flex items-start gap-4">
            <StoreLogo store={store} size={72} className="-mt-12 shrink-0 shadow-lg ring-4 ring-white sm:-mt-14 sm:!h-20 sm:!w-20" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">{store.name}</h1>
              {store.tagline && <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{store.tagline}</p>}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            {store.city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none" />
                </svg>
                {store.city}
              </span>
            )}
            {store.opening_hours && (
              <details className="group relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-blue-50 hover:text-blue-700 [&::-webkit-details-marker]:hidden">
                  🕒 {t("store.opening_hours")}
                  <span aria-hidden className="text-[9px] transition group-open:rotate-180">▾</span>
                </summary>
                <ul className="absolute start-0 top-full z-20 mt-2 w-72 max-w-[85vw] space-y-1.5 rounded-2xl border border-neutral-200 bg-white p-3 text-sm shadow-xl">
                  {DAY_KEYS.map((key) => {
                    const day = store.opening_hours?.[key];
                    const name = new Date(Date.UTC(2000, 0, WEEKDAY_ANCHOR + Number(key))).toLocaleDateString(
                      locale === "ar" ? "ar-SA" : "en-US",
                      { weekday: "long", timeZone: "UTC" }
                    );
                    return (
                      <li key={key} className="flex justify-between gap-3 text-neutral-600">
                        <span>{name}</span>
                        <span className="text-end font-medium">
                          {!day || day.closed
                            ? t("store.closed_day")
                            : shiftsOf(day)
                                .map((sh) => `${formatClock(sh.open, locale)} – ${formatClock(sh.close, locale)}`)
                                .join(" · ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>

          {statusInfo && !statusInfo.open && (
            <div className="mt-3 rounded-2xl bg-neutral-100 p-3 text-sm">
              <p className="font-bold text-neutral-900">{statusInfo.text}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{t("store.browse_only")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
