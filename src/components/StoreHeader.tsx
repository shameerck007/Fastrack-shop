"use client";

import Link from "@/components/Link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { ProductTopBar } from "@/components/MobileTopBar";
import DeliverToChip from "@/components/DeliverToChip";
import { StoreLogo } from "@/components/StoreBadge";
import { useLocale } from "@/components/LocaleProvider";

const roundBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-blue-50 hover:text-blue-700 active:scale-95";

/** The shop page's top bar. Phones get the floating back/cart buttons over the cover; wider screens get this bar:
 * back, the shop's logo and name, the delivery place and time in the middle, search and cart on the right. */
export default function StoreHeader({ store }: { store: { name: string; logo_url: string | null } }) {
  const { cartCount } = useCustomerHeaderState();
  const { t } = useLocale();

  return (
    <>
      <ProductTopBar />
      <header className="sticky top-0 z-30 hidden border-b border-neutral-200/70 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" aria-label="Back to FasTrack Shop" className={roundBtn}>
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[18px] w-[18px] rtl:-scale-x-100">
              <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <StoreLogo store={store} size={40} className="shadow-sm ring-1 ring-neutral-200" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight text-neutral-900">{store.name}</p>
              <p className="text-[11px] font-medium text-neutral-400">Powered by FasTrack Shop</p>
            </div>
          </div>

          <div className="mx-auto min-w-0">
            <DeliverToChip variant="stack" />
          </div>

          <Link href="/search" aria-label={t("header.search_placeholder")} className={roundBtn}>
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[18px] w-[18px]">
              <circle cx="9" cy="9" r="6" />
              <path d="m14 14 4 4" strokeLinecap="round" />
            </svg>
          </Link>

          <Link href="/cart" className="relative flex h-10 shrink-0 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-95">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
              <path d="M6 7h12l-1 12H7L6 7Z" strokeLinejoin="round" />
              <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
            </svg>
            {t("header.cart")}
            {cartCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-blue-700">{cartCount}</span>}
          </Link>
        </div>
      </header>
    </>
  );
}
