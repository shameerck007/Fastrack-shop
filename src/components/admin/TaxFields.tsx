"use client";

import { useMarket } from "@/components/MoneyProvider";
import { taxProfileFor } from "@/lib/tax";

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Tax rate (and HSN code for India) for a product. The choices follow the current market. */
export default function TaxFields({
  taxRate,
  onTaxRate,
  hsnCode,
  onHsnCode,
}: {
  taxRate: string;
  onTaxRate: (v: string) => void;
  hsnCode: string;
  onHsnCode: (v: string) => void;
}) {
  const { countryCode } = useMarket();
  const profile = taxProfileFor(countryCode);
  const value = taxRate === "" ? String(profile.defaultRate) : taxRate;
  const options = profile.rates.includes(Number(value)) ? profile.rates : [Number(value), ...profile.rates];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">{profile.label} rate (price includes tax)</label>
        <select value={value} onChange={(e) => onTaxRate(e.target.value)} className={`${inputClass} bg-white`}>
          {options.map((r) => (
            <option key={r} value={String(r)}>
              {r}%
            </option>
          ))}
        </select>
      </div>
      {countryCode === "IN" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">HSN code</label>
          <input
            inputMode="numeric"
            maxLength={8}
            value={hsnCode}
            onChange={(e) => onHsnCode(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 0402"
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
