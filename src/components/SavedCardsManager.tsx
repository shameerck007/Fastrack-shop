"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSavedCard, setDefaultCard, type SavedCard } from "@/lib/actions/payments";
import { unwrapAction, errorText } from "@/lib/errors";
import { useDialogs } from "@/components/ui/Dialogs";
import { BrandBadge } from "@/components/PaymentOptions";

/** The shopper's saved cards (Account > Payment methods): make one the default or remove it. */
export default function SavedCardsManager({ cards }: { cards: SavedCard[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Something went wrong. Please try again."));
      }
    });
  }

  async function remove(c: SavedCard) {
    const ok = await confirm({ title: `Remove the card ending ${c.last4}?`, message: "You can save it again the next time you pay by card.", confirmLabel: "Remove card", danger: true, icon: "💳" });
    if (ok) run(() => unwrapAction(deleteSavedCard)(c.id));
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
      {cards.map((c) => {
        const exp = c.expMonth && c.expYear ? `${String(c.expMonth).padStart(2, "0")}/${String(c.expYear).slice(-2)}` : null;
        return (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-50 text-2xl ring-1 ring-neutral-100">💳</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-neutral-900">
                <BrandBadge brand={c.brand} />
                <span className="font-mono tracking-wider">•••• {c.last4}</span>
                {c.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">Default</span>}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{[c.holderName, exp && `Expires ${exp}`].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:gap-2">
              {!c.isDefault && (
                <button type="button" disabled={pending} onClick={() => run(() => unwrapAction(setDefaultCard)(c.id))} className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                  Make default
                </button>
              )}
              <button type="button" disabled={pending} onClick={() => remove(c)} className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
