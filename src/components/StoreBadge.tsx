"use client";

import Link from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { useStoreInfo, type StoreInfo } from "@/components/StoreDirectoryProvider";
import { placeholderFor } from "@/lib/store-placeholder";
import { describeStatus, type OpenStatus } from "@/lib/store-hours";

/** Square (rounded) supplier logo; a coloured tile with the shop's first letter when there is no picture yet. */
export function StoreLogo({ store, size = 24, className = "" }: { store: Pick<StoreInfo, "name" | "logo_url">; size?: number; className?: string }) {
  const art = placeholderFor(store.name);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        borderRadius: Math.max(6, size * 0.24),
        background: store.logo_url ? "#fff" : art.gradient,
      }}
    >
      {store.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
      ) : (
        art.initial
      )}
    </span>
  );
}

/** Shop cover picture, or a branded placeholder (gradient, soft circles and a grocery emoji) until one is uploaded. */
export function StoreCover({ store, className = "", emojiSize = 56 }: { store: Pick<StoreInfo, "name" | "cover_url">; className?: string; emojiSize?: number }) {
  const art = placeholderFor(store.name);
  if (store.cover_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={store.cover_url} alt="" className={`h-full w-full object-cover ${className}`} />
    );
  }
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ background: art.gradient }}>
      <span className="absolute -end-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <span className="absolute -bottom-10 start-6 h-24 w-24 rounded-full bg-white/10" />
      <span className="absolute inset-0 flex items-center justify-center opacity-90 drop-shadow-lg" style={{ fontSize: emojiSize }}>
        {art.emoji}
      </span>
    </div>
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
