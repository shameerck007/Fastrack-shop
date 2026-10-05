"use client";

import { useState } from "react";
import { digitsOnly, type IdCheck } from "@/lib/saudi-tax";

/** Digits-only registration-number field with a live check: red hint once the
 * expected length is reached or the field is left, green tick when it's valid. */
export default function TaxIdInput({
  value,
  onChange,
  check,
  length,
  required,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  check: (raw: string) => IdCheck;
  length: number;
  required?: boolean;
  placeholder?: string;
}) {
  const [touched, setTouched] = useState(false);
  const result = check(value);
  const show = value.length > 0 && (touched || value.length >= length);
  const bad = show && !result.ok;
  const good = value.length > 0 && result.ok;

  return (
    <div>
      <input
        required={required}
        inputMode="numeric"
        autoComplete="off"
        maxLength={length}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(digitsOnly(e.target.value).slice(0, length))}
        onBlur={() => setTouched(true)}
        className={`w-full rounded-lg border px-3 py-2 font-mono text-sm tracking-wide ${
          bad ? "border-red-400" : good ? "border-emerald-400" : "border-neutral-300"
        }`}
      />
      {bad && <p className="mt-1 text-xs text-red-600">{result.error}</p>}
      {good && <p className="mt-1 text-xs text-emerald-600">✓ Looks valid</p>}
    </div>
  );
}
