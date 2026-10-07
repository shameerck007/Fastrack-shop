"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptExpressOffer, declineExpressOffer } from "@/lib/actions/rider";
import { useMoney } from "@/components/MoneyProvider";
import type { LiveOffer } from "@/lib/rider";

// The quick-delivery offer: one order, one countdown. Accept to take it; Decline (or letting the timer run out)
// passes it to the next nearest rider straight away.
export default function ExpressOfferCard({ offer }: { offer: LiveOffer }) {
  const money = useMoney();
  const router = useRouter();
  const [left, setLeft] = useState(offer.secondsLeft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = useRef(false);
  const total = useRef(Math.max(offer.secondsLeft, 1));

  useEffect(() => {
    const end = new Date(offer.expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [offer.expiresAt]);

  // Time ran out: let the system move on to the next rider, then refresh this screen.
  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    declineExpressOffer(offer.id)
      .catch(() => {})
      .finally(() => router.refresh());
  }, [left, offer.id, router]);

  const pct = Math.min(100, Math.max(0, (left / total.current) * 100));

  function accept() {
    if (done.current) return;
    setError(null);
    startTransition(async () => {
      try {
        done.current = true;
        await acceptExpressOffer(offer.id);
        router.refresh();
      } catch (e) {
        done.current = false;
        setError(e instanceof Error ? e.message : "Could not accept this order.");
        router.refresh();
      }
    });
  }

  function decline() {
    if (done.current) return;
    done.current = true;
    startTransition(async () => {
      await declineExpressOffer(offer.id).catch(() => {});
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-xl shadow-blue-600/15">
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-sky-500 px-4 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <span className="h-2 w-2 animate-ping rounded-full bg-white" /> New Express order
        </p>
        <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/20 px-2 text-base font-extrabold tabular-nums">{left}s</span>
      </div>
      <div className="h-1 bg-blue-100">
        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-neutral-900">#{offer.orderNumber}</p>
            {offer.shopName && <p className="mt-1 text-sm font-semibold text-neutral-800">📍 {offer.shopName}</p>}
            {offer.shopAddress && <p className="truncate text-xs text-neutral-500">{offer.shopAddress}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {offer.distanceKm != null && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">🧭 {offer.distanceKm.toFixed(1)} km to pickup</span>}
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">
                📦 {offer.itemCount} {offer.itemCount === 1 ? "item" : "items"}
              </span>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl bg-blue-50 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">You earn</p>
            <p className="text-lg font-extrabold text-blue-700">{money(offer.deliveryFee)}</p>
          </div>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-blue-900">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={decline}
            disabled={pending || left === 0}
            className="h-12 flex-1 rounded-full border border-neutral-300 bg-white text-sm font-bold text-neutral-700 active:scale-95 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={pending || left === 0}
            className="h-12 flex-[2] rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/25 active:scale-95 disabled:opacity-50"
          >
            {pending ? "Accepting…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
