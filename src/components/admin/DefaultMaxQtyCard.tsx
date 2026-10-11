"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton } from "@/components/ui/Form";
import { saveDefaultMaxOrderQty } from "@/lib/actions/admin-offers";

/** The maximum order quantity every new product starts with. Suppliers and FasTrack can still change it on each product. */
export default function DefaultMaxQtyCard({ value }: { value: number }) {
  const router = useRouter();
  const [v, setV] = useState(String(value));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">Maximum order quantity</h2>
      <p className="mb-3 mt-0.5 text-xs text-neutral-500">The most of one product a customer can put in an order. New products start with this number; a supplier or FasTrack can change it for any product.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} step={1} value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputClass} w-28`} aria-label="Default maximum order quantity" />
        <button
          type="button"
          disabled={pending || v === "" || Number(v) === value}
          className={primaryButton}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await saveDefaultMaxOrderQty(Number(v));
              if (res.error) setMsg({ ok: false, text: res.error });
              else {
                setMsg({ ok: true, text: "Saved. New products will start with this limit." });
                router.refresh();
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className={`text-sm font-medium ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
