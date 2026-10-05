"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";
import { formatSAR } from "@/lib/utils";
import { showsCartBar } from "@/lib/mobile-fullscreen";

// Mirrors checkout: free delivery from SAR 50, otherwise the standard fee.
const FREE_DELIVERY_FROM = 50;
const STANDARD_DELIVERY_FEE = 7;

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Keeta-style checkout bar: cart icon with item count, the total (with the
 * pre-discount price struck through and what you saved), the delivery fee,
 * and a big Check out button; above it a nudge toward free delivery.
 * `compact` drops the nudge and the card chrome for use inside the product
 * page's own bottom sheet. Renders nothing while the cart is empty. */
export function PlaceOrderPill({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { cartCount, cartTotal, cartSavings } = useCustomerHeaderState();
  const { t } = useLocale();

  if (cartCount <= 0) return null;

  const toFree = Math.max(0, FREE_DELIVERY_FROM - cartTotal);
  const delivery =
    toFree === 0 ? t("cartbar.free_delivery") : t("cartbar.delivery_fee", { fee: formatSAR(STANDARD_DELIVERY_FEE) });
  const subline = cartSavings > 0 ? `${t("cartbar.saved", { amount: formatSAR(cartSavings) })} · ${delivery}` : delivery;

  return (
    <div className={className}>
      {!compact && toFree > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-t-3xl bg-blue-50 px-4 py-2 text-xs font-medium text-blue-900">
          <span>{t("cartbar.add_for_free_delivery", { amount: formatSAR(toFree) })}</span>
          <Link href="/" className="shrink-0 rounded-full border border-blue-700 px-3 py-1 font-semibold text-blue-700">
            {t("cartbar.add_items")}
          </Link>
        </div>
      )}
      <div className={`flex items-center gap-3 px-4 py-3 ${compact ? "rounded-2xl bg-neutral-50" : "bg-white"}`}>
        <Link href="/cart" aria-label={t("header.cart")} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <CartIcon />
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[11px] font-bold text-white">
            {cartCount}
          </span>
        </Link>
        <Link href="/cart" className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-neutral-900">{formatSAR(cartTotal)}</span>
            {cartSavings > 0 && <span className="text-xs text-neutral-400 line-through">{formatSAR(cartTotal + cartSavings)}</span>}
          </p>
          <p className="truncate text-xs text-neutral-500">{subline}</p>
        </Link>
        <Link
          href="/checkout"
          className="shrink-0 rounded-full bg-blue-700 px-7 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800 active:scale-95"
        >
          {t("cartbar.checkout")}
        </Link>
      </div>
    </div>
  );
}

/** Pinned to the bottom of browsing pages on phones, in place of the tabs. */
export default function FloatingCartBar() {
  const pathname = usePathname();
  // Portals (admin/merchant/rider/warehouse) have their own chrome; shop pages (/store/...) keep the bar.
  if (!showsCartBar(pathname) || ["/admin", "/merchant", "/rider", "/warehouse"].some((p) => pathname.startsWith(p))) return null;

  return (
    <PlaceOrderPill
      className="fixed inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:hidden"
    />
  );
}
