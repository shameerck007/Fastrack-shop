"use client";

import { useState } from "react";
import type { CodeCheck } from "@/lib/india-business";

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Alphanumeric identifier box: uppercases, strips punctuation, and shows a live tick or the reason it is wrong. */
export default function CodeInput({
  value,
  onChange,
  check,
  maxLength,
  placeholder,
  numericOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  check: (raw: string) => CodeCheck;
  maxLength: number;
  placeholder: string;
  numericOnly?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const result = value ? check(value) : null;
  const show = !!value && (touched || value.length >= maxLength);
  const bad = show && result && !result.ok;
  const good = !!value && result?.ok;
  return (
    <div>
      <input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={numericOnly ? "numeric" : "text"}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const raw = e.target.value.toUpperCase();
          onChange((numericOnly ? raw.replace(/\D/g, "") : raw.replace(/[^A-Z0-9]/g, "")).slice(0, maxLength));
        }}
        onBlur={() => setTouched(true)}
        className={`${inputClass} font-mono tracking-wide ${bad ? "border-red-400" : good ? "border-emerald-400" : ""}`}
      />
      {bad && <p className="mt-1 text-xs text-red-600">{result?.error}</p>}
      {good && <p className="mt-1 text-xs text-emerald-600">✓ Looks valid</p>}
    </div>
  );
}
