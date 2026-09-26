"use client";

import Link from "next/link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";

export default function StoreHeader({ storeName }: { storeName: string }) {
  const { cartCount } = useCustomerHeaderState();

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-neutral-900">{storeName}</p>
          <p className="text-xs text-neutral-400">Powered by FasTrack Shop</p>
        </div>
        <Link href="/cart" className="relative flex shrink-0 items-center gap-1 text-sm hover:text-blue-600">
          🛒 Cart
          {cartCount > 0 && (
            <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
