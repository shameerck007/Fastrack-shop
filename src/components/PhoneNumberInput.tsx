"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, findCountry, type Country } from "@/lib/countries";
import { useDefaultCountry } from "@/components/DefaultCountryProvider";
import Select from "@/components/ui/Select";

/** Splits a stored value back into a country + national number for editing, so
 * re-opening a form with an existing phone shows the right flag. Accepts the
 * clean E.164 we store ("+966501234567") and older hand-typed values
 * ("0501234567", "+966 50 123 4567", "00966…"). */
function splitValue(value: string, fallbackCountry: Country): { country: Country; national: string } {
  let clean = value.replace(/[\s()-]/g, "");
  if (clean.startsWith("00")) clean = `+${clean.slice(2)}`;

  if (clean.startsWith("+")) {
    const match = COUNTRIES.filter((c) => clean.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
    if (match) return { country: match, national: clean.slice(match.dial.length) };
    return { country: fallbackCountry, national: clean.replace(/\D/g, "") };
  }
  return { country: fallbackCountry, national: clean.replace(/\D/g, "") };
}

/** A country-code dropdown plus the national number. The country starts as the
 * visitor's own (detected from their connection, see DefaultCountryProvider)
 * and can be changed; the value handed back is always clean E.164. */
export default function PhoneNumberInput({
  value,
  onChange,
  defaultCountryCode,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Overrides the detected country (rarely needed). */
  defaultCountryCode?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const detected = useDefaultCountry();
  const fallback = findCountry(defaultCountryCode ?? detected);
  const initial = splitValue(value, fallback);
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);

  // The parent can change the value from outside (a prefill that arrives late,
  // or a form reset). Re-sync then; ignore the echo of what we just emitted.
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = splitValue(value, fallback);
    setCountry(value ? next.country : country);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(nextCountry: Country, nextNational: string) {
    // A leading 0 is the national trunk prefix ("0501234567"), dropped
    // when combined with the country code.
    const digits = nextNational.replace(/\D/g, "").replace(/^0+/, "");
    const out = digits ? `${nextCountry.dial}${digits}` : "";
    lastEmitted.current = out;
    onChange(out);
  }

  return (
    <div className="flex gap-2">
      <Select
        value={country.code}
        onChange={(e) => {
          const next = findCountry(e.target.value);
          setCountry(next);
          emit(next, national);
        }}
        aria-label="Country code"
        className="w-[120px] shrink-0"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code} data-hint={c.name}>
            {c.flag} {c.dial}
          </option>
        ))}
      </Select>
      <input
        type="tel"
        inputMode="numeric"
        required={required}
        value={national}
        placeholder={placeholder}
        onChange={(e) => {
          setNational(e.target.value);
          emit(country, e.target.value);
        }}
        className="min-w-0 flex-1 min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}
