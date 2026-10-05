"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";

const HIDE_ON = ["/cart", "/checkout", "/login", "/register", "/account", "/orders"];

/** Keeta-style floating pill above the bottom nav: appears as soon as the
 * cart has something in it, one tap from checkout. Mobile only — desktop
 * has the header cart link. */
export default function FloatingCartBar() {
  const pathname = usePathname();
  const { cartCount } = useCustomerHeaderState();
  const { t } = useLocale();

  if (cartCount <= 0 || HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <Link
      href="/cart"
      className="fixed inset-x-4 z-40 flex items-center justify-between rounded-full bg-neutral-900 px-5 py-3 text-white shadow-xl shadow-black/25 transition active:scale-[0.98] md:hidden"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-neutral-900">
          {cartCount}
        </span>
        {t("home.cart_bar_items", { count: cartCount })}
      </span>
      <span className="text-sm font-bold text-amber-300">{t("home.cart_bar_view")} →</span>
    </Link>
  );
}
