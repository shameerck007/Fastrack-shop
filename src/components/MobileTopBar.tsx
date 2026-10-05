"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { smartBack } from "@/components/BackBar";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { useLocale } from "@/components/LocaleProvider";

const roundBtn =
  "flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/5 transition active:scale-90";

function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  return (
    <button type="button" onClick={() => smartBack(router, pathname)} aria-label={t("common.back")} className={roundBtn}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-5 w-5 rtl:-scale-x-100">
        <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function CartButton() {
  const { cartCount } = useCustomerHeaderState();
  const { t } = useLocale();
  return (
    <Link href="/cart" aria-label={t("header.cart")} className={`${roundBtn} relative`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19 8H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      {cartCount > 0 && (
        <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold text-neutral-900">
          {cartCount}
        </span>
      )}
    </Link>
  );
}

/** Product page: buttons float over the full-bleed photo, no bar of its own. */
export function ProductTopBar({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <span className="pointer-events-auto">
        <BackButton />
      </span>
      <span className="pointer-events-auto flex items-center gap-2">
        {children}
        <CartButton />
      </span>
    </div>
  );
}

/** Category page: a slim sticky bar with the title, replacing the global header on phones. */
export function MobileTitleBar({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 bg-white/95 px-4 pb-2.5 shadow-sm backdrop-blur md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <BackButton />
      <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight">{title}</h1>
      <Link href="/search" aria-label={t("header.search_placeholder")} className={roundBtn}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[18px] w-[18px]">
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
      </Link>
      <CartButton />
    </div>
  );
}
