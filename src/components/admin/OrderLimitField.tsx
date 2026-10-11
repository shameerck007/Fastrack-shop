"use client";

import { Field, inputClass } from "@/components/ui/Form";
import { useDefaultMaxQty } from "@/components/MoneyProvider";

/** "Maximum order quantity": the most one order may hold of this product. Required; new products start at the market's default. */
export default function OrderLimitField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fallback = useDefaultMaxQty();
  return (
    <Field label="Maximum order quantity" required hint={`The most a customer can buy of this product in one order (for each size). New products start at ${fallback}.`}>
      <input type="number" min={1} step={1} inputMode="numeric" required value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))} placeholder={String(fallback)} className={inputClass} />
    </Field>
  );
}
