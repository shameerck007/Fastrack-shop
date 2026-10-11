"use client";

import { Field, inputClass } from "@/components/ui/Form";

/** "Maximum order quantity": the most one order may hold of this product. Empty = no limit. */
export default function OrderLimitField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Maximum order quantity" hint="The most a customer can buy of this product in one order (for each size). Leave empty for no limit.">
      <input type="number" min={1} step={1} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))} placeholder="No limit" className={inputClass} />
    </Field>
  );
}
