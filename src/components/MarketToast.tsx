"use client";

import { useEffect, useState } from "react";
import { MARKET_TOAST_KEY } from "@/components/MarketSwitchDialog";
import Flag from "@/components/Flag";

/** Confirms a country switch after the page reloads: "🇮🇳 You're now shopping in India". */
export default function MarketToast() {
  const [info, setInfo] = useState<{ code: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MARKET_TOAST_KEY);
      if (!raw) return;
      sessionStorage.removeItem(MARKET_TOAST_KEY);
      setInfo(JSON.parse(raw));
      const timer = setTimeout(() => setInfo(null), 4500);
      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, []);

  if (!info) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[3000] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
        <Flag code={info.code} className="h-[18px] w-6" />
        <span>You&apos;re now shopping in {info.name}</span>
        <button type="button" onClick={() => setInfo(null)} aria-label="Dismiss" className="text-white/60 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}
