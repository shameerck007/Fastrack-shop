"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { useStoreInfo, type StoreInfo } from "@/components/StoreDirectoryProvider";
import { describeStatus, type OpenStatus } from "@/lib/store-hours";

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
  return describeStatus(status, locale, t);
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

/** Dimmed overlay across a product photo when its shop is closed. */
export function ClosedOverlay({ status }: { status: OpenStatus | null }) {
  const info = useStatusText(status);
  if (!info || info.open) return null;
  return (
    <span className="absolute inset-0 z-[5] flex items-center justify-center bg-white/55 p-2">
      <span className="rounded-full bg-neutral-900/85 px-3 py-1 text-center text-[11px] font-bold leading-tight text-white">{info.text}</span>
    </span>
  );
}

/** Full-width notice shown where a closed shop's items are listed. */
export function ClosedBanner({ storeId, className = "" }: { storeId: string | null | undefined; className?: string }) {
  const { t } = useLocale();
  const { store, status } = useStoreInfo(storeId);
  const info = useStatusText(status);
  if (!store || !info || info.open) return null;
  return (
    <div className={`rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-700 ${className}`}>
      <p className="font-bold text-neutral-900">{info.text}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{t("store.browse_only")}</p>
    </div>
  );
}
