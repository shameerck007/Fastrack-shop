"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";
import { formatSAR } from "@/lib/utils";

const HIDE_ON = ["/products", "/cart", "/checkout", "/login", "/register", "/account", "/orders"];

/** Keeta-style checkout pill: item count + total on the left, a yellow Place
 * order button on the right that goes straight to checkout (tapping the
 * count/total opens the cart). Renders nothing while the cart is empty. */
export function PlaceOrderPill({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const { cartCount, cartTotal } = useCustomerHeaderState();
  const { t } = useLocale();

  if (cartCount <= 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-full bg-neutral-900 py-2 pe-2 ps-5 text-white shadow-xl shadow-black/25 ${className}`}
      style={style}
    >
      <Link href="/cart" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-neutral-900">
          {cartCount}
        </span>
        <span className="truncate">{cartTotal > 0 ? formatSAR(cartTotal) : t("home.cart_bar_items", { count: cartCount })}</span>
      </Link>
      <Link
        href="/checkout"
        className="shrink-0 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-extrabold text-neutral-900 transition active:scale-95"
      >
        {t("checkout.place_order")}
      </Link>
    </div>
  );
}

/** Floats above the bottom nav on browsing pages (phones only). Product pages
 * embed the same pill inside their own bottom sheet instead. */
export default function FloatingCartBar() {
  const pathname = usePathname();

  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <PlaceOrderPill
      className="fixed inset-x-4 z-40 md:hidden"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    />
  );
}
