"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmReturnPickup } from "@/lib/actions/returns";
import { errorText, unwrapAction } from "@/lib/errors";
import { reasonLabel } from "@/lib/returns";

export interface ReturnPickup {
  id: string;
  return_number: string;
  order_number: string;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  reason: string;
  customer_name: string | null;
  customer_phone: string | null;
  address_line: string | null;
  city: string | null;
  district: string | null;
  building_number: string | null;
  unit_number: string | null;
  lat: number | null;
  lng: number | null;
}

/** A return to collect: where it is, who to call, and the customer's 4-digit code that confirms the handover. */
export default function ReturnPickupCard({ p }: { p: ReturnPickup }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const where = [p.address_line, [p.building_number && `Bldg ${p.building_number}`, p.unit_number && `Unit ${p.unit_number}`].filter(Boolean).join(", "), [p.district, p.city].filter(Boolean).join(", ")].filter(Boolean);
  const nav = p.lat != null && p.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : p.address_line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address_line)}` : null;

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await unwrapAction(confirmReturnPickup)(p.id, code);
        router.refresh();
      } catch (err) {
        setError(errorText(err, "Could not confirm the collection."));
      }
    });
  }

  return (
    <li className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-neutral-900">
            {p.product_name} × {p.quantity}
          </p>
          <p className="text-xs text-neutral-500">
            {p.return_number} · order #{p.order_number} · {reasonLabel(p.reason)}
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800">Collect</span>
      </div>
      <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-sm">
        <p className="font-semibold text-neutral-900">{p.customer_name ?? "Customer"}</p>
        {where.map((l, i) => (
          <p key={i} className="text-neutral-600">
            {l}
          </p>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          {nav && (
            <a href={nav} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
              🧭 Navigate
            </a>
          )}
          {p.customer_phone && (
            <a href={`tel:${p.customer_phone}`} className="inline-flex h-9 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800">
              📞 Call
            </a>
          )}
        </div>
      </div>
      <form onSubmit={confirm} className="mt-3 flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={4}
          placeholder="Code"
          aria-label="The customer's return code"
          className="h-10 w-28 rounded-xl border border-neutral-300 px-3 text-center text-base font-bold tracking-[0.35em] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button type="submit" disabled={pending || code.length !== 4} className="h-10 rounded-full bg-brand-700 px-5 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Checking…" : "Confirm collected"}
        </button>
      </form>
      <p className="mt-1.5 text-[11px] text-neutral-500">Check the item first, then ask the customer for the code on their order page.</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  );
}

export interface ReturnDropoff {
  id: string;
  return_number: string;
  order_number: string;
  product_name: string;
  quantity: number;
  return_to: "warehouse" | "supplier";
  dest_name: string | null;
  dest_address: string | null;
  dest_phone: string | null;
  lat: number | null;
  lng: number | null;
}

/** A collected item that still has to be taken back to the supplier or warehouse. They check it in themselves. */
export function ReturnDropoffCard({ d }: { d: ReturnDropoff }) {
  const nav = d.lat != null && d.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` : d.dest_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.dest_address)}` : null;
  return (
    <li className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="truncate font-bold text-neutral-900">
        {d.product_name} × {d.quantity}
      </p>
      <p className="text-xs text-neutral-500">
        {d.return_number} · order #{d.order_number}
      </p>
      <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{d.return_to === "supplier" ? "Take it back to the supplier" : "Take it to the warehouse"}</p>
        <p className="font-semibold text-neutral-900">{d.dest_name ?? "Store"}</p>
        {d.dest_address && <p className="text-neutral-600">{d.dest_address}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {nav && (
            <a href={nav} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
              🧭 Navigate
            </a>
          )}
          {d.dest_phone && (
            <a href={`tel:${d.dest_phone}`} className="inline-flex h-9 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800">
              📞 Call
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
