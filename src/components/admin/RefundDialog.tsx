"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";
import { useMoney } from "@/components/MoneyProvider";
import { refundOrder } from "@/lib/actions/admin-orders";
import { unwrapAction } from "@/lib/errors";

export interface RefundItem {
  id: string;
  name: string;
  ordered: number;
  refunded: number;
  /** What the customer paid for one unit, after any discount. */
  unitNet: number;
}

/** Refund part or all of an order: choose the items and how many, and whether the delivery fee goes back. */
export default function RefundDialog({ orderId, items, deliveryFee, deliveryRefunded }: { orderId: string; items: RefundItem[]; deliveryFee: number; deliveryRefunded: boolean }) {
  const money = useMoney();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [delivery, setDelivery] = useState(false);
  const [reason, setReason] = useState("");
  const left = (i: RefundItem) => Math.max(0, i.ordered - i.refunded);
  const canDelivery = !deliveryRefunded && deliveryFee > 0;
  const itemsTotal = items.reduce((n, i) => n + (qty[i.id] ?? 0) * i.unitNet, 0);
  const total = Math.round((itemsTotal + (delivery && canDelivery ? deliveryFee : 0)) * 100) / 100;
  const set = (id: string, v: number, max: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, v)) }));

  async function save(): Promise<string | void> {
    if (total <= 0) return "Choose what to refund: at least one item, or the delivery fee.";
    await unwrapAction(refundOrder)(orderId, items.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] ?? 0 })), delivery && canDelivery, reason);
    setQty({});
    setDelivery(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-rose-300 px-3.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
        Refund…
      </button>
      {open && (
        <FormDialog icon="↩️" title="Refund this order" subtitle="Choose what goes back to the customer" saveLabel={total > 0 ? `Refund ${money(total)}` : "Refund"} onClose={() => setOpen(false)} onSave={save}>
          <DialogSection title="Items" hint="Each supplier's payout, FasTrack's commission and the tax are reversed for the units you choose.">
            <div className="sm:col-span-2 flex flex-col divide-y divide-neutral-100">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{i.name}</p>
                    <p className="text-xs text-neutral-500">
                      {money(i.unitNet)} each · ordered {i.ordered}
                      {i.refunded > 0 ? ` · ${i.refunded} already refunded` : ""}
                    </p>
                  </div>
                  {left(i) === 0 ? (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">Refunded</span>
                  ) : (
                    <div className="flex items-center rounded-full border border-neutral-300">
                      <button type="button" className="px-3 py-1 text-base disabled:opacity-40" disabled={(qty[i.id] ?? 0) <= 0} onClick={() => set(i.id, (qty[i.id] ?? 0) - 1, left(i))}>
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{qty[i.id] ?? 0}</span>
                      <button type="button" className="px-3 py-1 text-base disabled:opacity-40" disabled={(qty[i.id] ?? 0) >= left(i)} onClick={() => set(i.id, (qty[i.id] ?? 0) + 1, left(i))}>
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="sm:col-span-2">
              <button type="button" onClick={() => setQty(Object.fromEntries(items.map((i) => [i.id, left(i)])))} className="text-xs font-bold text-brand-700 hover:underline">
                Select everything that is left
              </button>
            </div>
          </DialogSection>

          {canDelivery && (
            <DialogSection cols={1}>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
                <span>
                  <span className="font-bold text-neutral-900">Also refund the delivery fee ({money(deliveryFee)})</span>
                  <span className="block text-xs text-neutral-500">The delivery fee is FasTrack&apos;s, so no supplier is charged for it.</span>
                </span>
              </label>
            </DialogSection>
          )}

          <DialogSection cols={1}>
            <Field label="Reason" hint="Shown to the customer in the refund message.">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: item arrived damaged" className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
