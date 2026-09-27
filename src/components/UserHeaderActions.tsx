"use client";

import Link from "next/link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";

export default function UserHeaderActions() {
  const { loaded, signedIn, firstName, cartCount } = useCustomerHeaderState();
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/orders" className="leading-tight hover:text-blue-600">
        <span className="block text-[11px] text-neutral-500">{t("header.returns")}</span>
        <span className="font-medium">{t("header.my_orders")}</span>
      </Link>
      <Link href="/cart" className="relative flex items-center gap-1 hover:text-blue-600">
        🛒 {t("header.cart")}
        {loaded && cartCount > 0 && (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white rtl:right-auto rtl:-left-3">
            {cartCount}
          </span>
        )}
      </Link>
      {signedIn ? (
        <Link href="/account" className="leading-tight hover:text-blue-600">
          <span className="block text-[11px] text-neutral-500">
            {t("header.hello")}, {firstName ?? "—"}
          </span>
          <span className="font-medium">{t("header.account")}</span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-full bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800"
        >
          {t("header.login")}
        </Link>
      )}
    </div>
  );
}
