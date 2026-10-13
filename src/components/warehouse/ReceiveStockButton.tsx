"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { receiveStock } from "@/lib/actions/transfers";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";

/** A delivery arrives: add the quantity to this stock line, with an optional batch number and expiry date. Opens a popup. */
export default function ReceiveStockButton({ inventoryId }: { inventoryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");

  async function save(): Promise<string | void> {
    if (!(Number(qty) > 0)) return "Enter the quantity received.";
    const res = await unwrapAction(receiveStock)(inventoryId, Number(qty), batch, expiry || undefined);
    if (res.error) return res.error;
    setQty("");
    setBatch("");
    setExpiry("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-brand-600 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">
        + Receive
      </button>
      {open && (
        <FormDialog icon="📦" title="Receive stock" subtitle="Add a delivery to this stock line" saveLabel="Add to stock" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection>
            <Field label="Quantity received" required className="sm:col-span-2">
              <input required type="number" min={0.001} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Batch number" hint="Optional.">
              <input value={batch} onChange={(e) => setBatch(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Expiry date" hint="Optional.">
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
