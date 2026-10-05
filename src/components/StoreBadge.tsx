"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { useStoreInfo, type StoreInfo } from "@/components/StoreDirectoryProvider";
import { formatClock, formatNextOpening, type OpenStatus } from "@/lib/store-hours";

/** Round supplier logo, falling back to the shop's first letter. */
export function StoreLogo({ store, size = 24, className = "" }: { store: Pick<StoreInfo, "name" | "logo_url">; size?: number; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-700 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {store.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
      ) : (
        store.name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** "Closed · Opens tomorrow 9:00 AM" / "Open · Closes 11:00 PM" / "Not taking orders". */
export function useStatusText(status: OpenStatus | null): { text: string; open: boolean } | null {
  const { t, locale } = useLocale();
  if (!status) return null;
  if (status.open) {
    return { open: true, text: status.closesAt ? `${t("store.open")} · ${t("store.closes", { time: formatClock(status.closesAt, locale) })}` : t("store.open") };
  }
  if (status.reason === "paused") return { open: false, text: t("store.paused") };
  const when = status.next ? formatNextOpening(status.next, locale, { today: t("store.today"), tomorrow: t("store.tomorrow") }) : null;
  return { open: false, text: when ? `${t("store.closed")} · ${t("store.opens", { when })}` : t("store.closed") };
}

export function StatusPill({ status, className = "" }: { status: OpenStatus | null; className?: string }) {
  const info = useStatusText(status);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        info.open ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-700"
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${info.open ? "bg-emerald-500" : "bg-neutral-500"}`} />
      {info.text}
    </span>
  );
}

/** Small "Sold by [logo] Name" line for cards and the product page. */
export function SoldBy({ storeId, linked = false, className = "" }: { storeId: string | null | undefined; linked?: boolean; className?: string }) {
  const { t } = useLocale();
  const { store } = useStoreInfo(storeId);
  if (!store) return null;
  const content = (
    <>
      <StoreLogo store={store} size={18} />
      <span className="truncate">{store.name}</span>
    </>
  );
  return linked ? (
    <Link href={`/store/${store.id}`} className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-blue-700 ${className}`} aria-label={`${t("store.sold_by")} ${store.name}`}>
      {content}
    </Link>
  ) : (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-600 ${className}`}>{content}</span>
  );
}
