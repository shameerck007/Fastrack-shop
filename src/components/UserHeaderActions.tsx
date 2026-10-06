"use client";

import Link from "@/components/Link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";
import NotificationBell from "@/components/NotificationBell";

export default function UserHeaderActions() {
  const { loaded, signedIn, firstName, cartCount } = useCustomerHeaderState();
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Not in the mobile bottom nav (unlike Orders/Cart/Account above),
          so unlike those this stays visible at every width. */}
      {loaded && signedIn && <NotificationBell />}
      {/* Already in the mobile bottom nav (Orders tab) — showing it here too
          just crowds the header on a phone screen with no extra value. */}
      <Link href="/orders" className="hidden leading-tight hover:text-blue-600 md:block">
        <span className="block text-[11px] text-neutral-500">{t("header.returns")}</span>
        <span className="font-medium">{t("header.my_orders")}</span>
      </Link>
      {/* Same reasoning again — Cart already has its own tab (with the same
          badge) in the mobile bottom nav. */}
      <Link href="/cart" className="relative hidden items-center gap-1 hover:text-blue-600 md:flex">
        🛒 {t("header.cart")}
        {loaded && cartCount > 0 && (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white rtl:right-auto rtl:-left-3">
            {cartCount}
          </span>
        )}
      </Link>
      {/* Same reasoning as the Orders link above — Account/Login already has
          its own tab in the mobile bottom nav, always on screen, so this
          only needs to exist for desktop where there's no bottom nav. The
          "Hello, {name}" line was also the actual cause of the reported
          overflow: an unbounded-width greeting with no truncation could
          push past the viewport edge on a narrow phone. */}
      {signedIn ? (
        <Link href="/account" className="hidden max-w-[140px] leading-tight hover:text-blue-600 md:block">
          <span className="block truncate text-[11px] text-neutral-500">
            {t("header.hello")}, {firstName ?? "—"}
          </span>
          <span className="font-medium">{t("header.account")}</span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="hidden rounded-full bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800 md:inline-block"
        >
          {t("header.login")}
        </Link>
      )}
    </div>
  );
}
