"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass, secondaryButton } from "@/components/ui/Form";
import { useMoney } from "@/components/MoneyProvider";
import { adjustRiderPay } from "@/lib/actions/admin-orders";
import { unwrapAction } from "@/lib/errors";

/** Pay the rider for a failed delivery, or deduct from the rider after a refund. Shown on the admin order page. */
export default function RiderPayAdjustDialog({ orderId, kind, max, suggested, riderName }: { orderId: string; kind: "failed_delivery" | "refund_clawback"; max: number; suggested: number; riderName: string }) {
  const money = useMoney();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggested));
  const [note, setNote] = useState("");
  const pay = kind === "failed_delivery";

  async function save(): Promise<string | void> {
    const n = Number(amount);
    if (!(n > 0)) return "Enter an amount greater than zero.";
    if (n > max) return `The amount cannot be more than ${money(max)}.`;
    await unwrapAction(adjustRiderPay)(orderId, kind, n, note);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${secondaryButton} mt-2 w-full`}>
        {pay ? "Pay rider for failed delivery…" : "Deduct from rider…"}
      </button>
      {open && (
        <FormDialog icon={pay ? "🛵" : "➖"} title={pay ? "Pay the rider for a failed delivery" : "Deduct from the rider"} subtitle={riderName} saveLabel={pay ? "Pay rider" : "Record deduction"} onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1} hint={pay ? `The order was cancelled after ${riderName} was assigned. You can pay up to ${money(max)}, once.` : `This order was refunded after delivery. A deduction is taken off ${riderName}'s balance, up to the refunded ${money(max)}, once. Use it only when the rider is at fault.`}>
            <Field label="Amount">
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Note" hint="Shown in the rider's statement.">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={pay ? "For example: customer was not at home" : "For example: item damaged on the way"} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
