"use client";

import Link from "@/components/Link";
import ScrollRow from "@/components/ScrollRow";
import { useMemo } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { useAllStores } from "@/components/StoreDirectoryProvider";
import { StoreCover, StoreLogo } from "@/components/StoreBadge";
import { describeStatus, getOpenStatus } from "@/lib/store-hours";
import { useMarket } from "@/components/MoneyProvider";
import { marketOffsetMinutes } from "@/lib/timezone";

/** Keeta-style row of partner shops: open ones first, closed ones greyed
 * out with when they open again. */
export default function ShopsRow() {
  const { t, locale } = useLocale();
  const { stores, tick } = useAllStores();
  const offset = marketOffsetMinutes(useMarket().countryCode);

  const shops = useMemo(() => {
    const rows = stores.map((store) => {
      const status = getOpenStatus(store.opening_hours, store.accepting_orders, new Date(), offset);
      return { store, info: describeStatus(status, locale, t) };
    });
    return rows.sort((a, b) => Number(b.info.open) - Number(a.info.open) || a.store.name.localeCompare(b.store.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, locale, tick, offset]);

  if (shops.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-extrabold tracking-tight">{t("store.shops_title")}</h2>
      <ScrollRow className="-mx-4 md:mx-0" innerClassName="gap-3 px-4 pb-2 md:px-1">
        {shops.map(({ store, info }) => (
          <Link
            key={store.id}
            href={`/store/${store.id}`}
            className="group w-40 shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-100 transition active:scale-[0.97] md:w-48 md:hover:-translate-y-0.5 md:hover:shadow-md"
          >
            <span className={`relative block h-28 w-full overflow-hidden md:h-32 ${info.open ? "" : "grayscale"}`}>
              <StoreCover store={store} emojiSize={52} />
              {!info.open && <span className="absolute inset-0 bg-white/40" />}
              <span className="absolute bottom-2 start-2">
                <StoreLogo store={store} size={44} className="shadow-md ring-2 ring-white" />
              </span>
              {!info.open && (
                <span className="absolute end-2 top-2 rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-bold text-white">{t("store.closed_badge")}</span>
              )}
            </span>
            <span className="block px-3 pb-3 pt-2">
              <span className="block truncate text-sm font-extrabold text-neutral-900">{store.name}</span>
              <span className={`mt-0.5 line-clamp-1 text-[11px] font-semibold ${info.open ? "text-emerald-600" : "text-neutral-500"}`}>
                {info.text}
              </span>
              {(store.tagline || store.city) && (
                <span className="mt-0.5 block truncate text-[11px] text-neutral-400">{store.tagline || store.city}</span>
              )}
            </span>
          </Link>
        ))}
      </ScrollRow>
    </section>
  );
}
