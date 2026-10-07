"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { signOut } from "@/lib/actions/auth";
import LanguageToggle from "@/components/LanguageToggle";

// The rider header's overflow menu: keeps the bar to logo + bell + one button, which fits a phone.
export default function RiderMenu({ backToShop, logOut }: { backToShop: string; logOut: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-700 active:scale-95"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-50 w-60 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
          <Link href="/rider/earnings" onClick={() => setOpen(false)} className={item}>
            <span>💰</span> Earnings
          </Link>
          <Link href="/rider/history" onClick={() => setOpen(false)} className={item}>
            <span>🧾</span> Trips
          </Link>
          <Link href="/api/enter-shop" prefetch={false} className={item}>
            <span>🛍️</span> {backToShop}
          </Link>
          <div className="my-1 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-neutral-700">
            <span className="flex items-center gap-3">
              <span>🌐</span> Language
            </span>
            <LanguageToggle />
          </div>
          <form action={signOut} className="border-t border-neutral-100 pt-1">
            <button className={`${item} text-red-600 hover:bg-red-50`}>
              <span>⎋</span> {logOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
