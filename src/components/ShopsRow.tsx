"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { useAllStores } from "@/components/StoreDirectoryProvider";
import { StoreLogo } from "@/components/StoreBadge";
import { describeStatus, getOpenStatus } from "@/lib/store-hours";

/** Keeta-style row of partner shops: open ones first, closed ones greyed
 * out with when they open again. */
export default function ShopsRow() {
  const { t, locale } = useLocale();
  const { stores, tick } = useAllStores();

  const shops = useMemo(() => {
    const rows = stores.map((store) => {
      const status = getOpenStatus(store.opening_hours, store.accepting_orders);
      return { store, info: describeStatus(status, locale, t) };
    });
    return rows.sort((a, b) => Number(b.info.open) - Number(a.info.open) || a.store.name.localeCompare(b.store.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, locale, tick]);

  if (shops.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-extrabold tracking-tight">{t("store.shops_title")}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {shops.map(({ store, info }) => (
          <Link key={store.id} href={`/store/${store.id}`} className="flex w-24 shrink-0 snap-start flex-col items-center gap-1.5 text-center">
            <span className={`rounded-full p-0.5 ring-2 ${info.open ? "ring-blue-600" : "ring-neutral-200"}`}>
              <StoreLogo store={store} size={64} className={`border-2 border-white ${info.open ? "" : "opacity-60 grayscale"}`} />
            </span>
            <span className="w-full truncate text-xs font-bold text-neutral-900">{store.name}</span>
            <span className={`line-clamp-2 text-[10px] font-medium leading-tight ${info.open ? "text-emerald-600" : "text-neutral-500"}`}>
              {info.text}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
