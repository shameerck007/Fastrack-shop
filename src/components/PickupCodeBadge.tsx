"use client";

import { useState } from "react";
import { getPickupCode } from "@/lib/actions/pickup-code";
import { errorText, unwrapAction } from "@/lib/errors";
import type { OrderStatus } from "@/types/database";

const SHOW_IN: OrderStatus[] = ["preparing", "ready_for_pickup", "rider_assigned"];

/** For the store: tap to show the 4-digit code the rider must give when collecting this order. */
export default function PickupCodeBadge({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!SHOW_IN.includes(status)) return null;

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      setCode(await unwrapAction(getPickupCode)(orderId));
    } catch (e) {
      setError(errorText(e, "Could not get the pickup code."));
    } finally {
      setLoading(false);
    }
  }

  if (code) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Pickup code</p>
        <p className="text-xl font-extrabold tracking-[0.3em] text-brand-900">{code}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={reveal} disabled={loading} className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-bold text-brand-800 transition hover:bg-brand-50 disabled:opacity-50">
        {loading ? "…" : "🔑 Show pickup code"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
