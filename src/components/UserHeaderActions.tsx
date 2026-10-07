"use client";

import Link from "@/components/Link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";
import NotificationBell from "@/components/NotificationBell";

export default function UserHeaderActions() {
  const { loaded, signedIn, firstName, cartCount } = useCustomerHeaderState();
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-2 text-sm lg:gap-3">
      {/* Not in the mobile bottom nav (unlike Orders/Cart/Account above),
          so unlike those this stays visible at every width. */}
      {loaded && signedIn && <NotificationBell />}
      {/* Already in the mobile bottom nav (Orders tab) — showing it here too
          just crowds the header on a phone screen with no extra value. */}
      <Link href="/orders" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-semibold text-neutral-800 hover:bg-blue-50 hover:text-blue-700 md:block">
        {t("header.my_orders")}
      </Link>
      {/* Same reasoning again — Cart already has its own tab (with the same
          badge) in the mobile bottom nav. */}
      <Link href="/cart" className="relative hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-200 px-4 py-2 text-[15px] font-semibold text-neutral-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 md:flex">
        🛒 {t("header.cart")}
        {loaded && cartCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white rtl:right-auto rtl:-left-2">
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
        <Link href="/account" className="hidden max-w-[150px] rounded-full px-3 py-1.5 leading-tight hover:bg-blue-50 hover:text-blue-700 md:block">
          <span className="block truncate text-[11px] text-neutral-500">
            {t("header.hello")}, {firstName ?? "—"}
          </span>
          <span className="font-medium">{t("header.account")}</span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="hidden whitespace-nowrap rounded-full bg-blue-700 px-6 py-2 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-800 md:inline-block"
        >
          {t("header.login")}
        </Link>
      )}
    </div>
  );
}
