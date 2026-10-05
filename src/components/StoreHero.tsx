"use client";

import { useMemo, useState, useEffect } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { StatusPill, StoreLogo, useStatusText } from "@/components/StoreBadge";
import type { StoreInfo } from "@/components/StoreDirectoryProvider";
import { DAY_KEYS, formatClock, getOpenStatus, shiftsOf } from "@/lib/store-hours";

const WEEKDAY_ANCHOR = 2; // 2000-01-02 was a Sunday

export default function StoreHero({ store }: { store: StoreInfo }) {
  const { t, locale } = useLocale();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const status = useMemo(() => getOpenStatus(store.opening_hours, store.accepting_orders), [store, tick]);
  const statusInfo = useStatusText(status);

  return (
    <section className="bg-white">
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 sm:h-56">
        {store.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.cover_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-4">
        <div className="relative z-10 -mt-10 flex items-end gap-3">
          <StoreLogo store={store} size={80} className="shadow-md ring-4 ring-white" />
        </div>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-900">{store.name}</h1>
        {store.tagline && <p className="mt-0.5 text-sm text-neutral-500">{store.tagline}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          {store.city && <span className="text-xs text-neutral-400">{store.city}</span>}
        </div>

        {statusInfo && !statusInfo.open && (
          <div className="mt-3 rounded-2xl bg-neutral-100 p-3 text-sm">
            <p className="font-bold text-neutral-900">{statusInfo.text}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{t("store.browse_only")}</p>
          </div>
        )}

        {store.opening_hours && (
          <details className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-neutral-700">{t("store.opening_hours")}</summary>
            <ul className="mt-2 space-y-1">
              {DAY_KEYS.map((key) => {
                const day = store.opening_hours?.[key];
                const name = new Date(Date.UTC(2000, 0, WEEKDAY_ANCHOR + Number(key))).toLocaleDateString(
                  locale === "ar" ? "ar-SA" : "en-US",
                  { weekday: "long", timeZone: "UTC" }
                );
                return (
                  <li key={key} className="flex justify-between text-neutral-600">
                    <span>{name}</span>
                    <span className="font-medium text-end">
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
    </section>
  );
}
