"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { setMarket } from "@/lib/actions/tenant";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";

export const MARKET_TOAST_KEY = "fs_market_toast";

/** A friendly "Switch to India?" step: says what changes and what stays, then switches without a logout. */
export default function MarketSwitchDialog({
  open,
  target,
  current,
  onClose,
}: {
  open: boolean;
  target: Tenant | null;
  current: Tenant | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!target || !current) return null;
  const to = findCountry(target.country_code);
  const from = findCountry(current.country_code);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await setMarket(target!.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      try {
        sessionStorage.setItem(MARKET_TOAST_KEY, JSON.stringify({ flag: to.flag, name: to.name }));
      } catch {
        // storage can be blocked; the switch still works, only the confirmation toast is lost
      }
      window.location.reload();
    });
  }

  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} size="md">
      <div className="text-center">
        <div className="mx-auto mb-3 flex items-center justify-center gap-3 text-4xl">
          <span className="opacity-60">{from.flag}</span>
          <span className="text-xl text-neutral-300">→</span>
          <span>{to.flag}</span>
        </div>
        <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">Switch to {to.name}?</h2>
        <p className="mt-1 text-sm text-neutral-500">You stay signed in. Only the shop changes.</p>
      </div>

      <ul className="mt-4 space-y-2 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
        <li className="flex gap-2.5">
          <span>🏪</span>
          <span>You will see the stores and products available in {to.name}.</span>
        </li>
        <li className="flex gap-2.5">
          <span>💱</span>
          <span>
            Prices are shown in {target.currency}, with that country&apos;s delivery charges and taxes.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span>🛒</span>
          <span>
            Your {from.name} cart, addresses and orders are kept separate and will be here when you switch back.
          </span>
        </li>
      </ul>

      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-blue-700 px-6 font-extrabold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800 disabled:opacity-70"
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Switching to {to.name}…
            </>
          ) : (
            <>Switch to {to.name}</>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="h-12 flex-1 rounded-full border border-neutral-300 bg-white px-6 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Stay in {from.name}
        </button>
      </div>
    </Modal>
  );
}
