"use client";

import { useState } from "react";
import { COUNTRIES, findCountry, type Country } from "@/lib/countries";

/** Splits a stored E.164-ish value ("+966501234567") back into a country +
 * national number for editing, so re-opening a form with an existing phone
 * shows the right flag instead of always resetting to the default country. */
function splitValue(value: string, fallbackCountry: Country): { country: Country; national: string } {
  const match = COUNTRIES.filter((c) => value.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  if (match) return { country: match, national: value.slice(match.dial.length) };
  return { country: fallbackCountry, national: value.replace(/^\+?\d*$/, "") };
}

export default function PhoneNumberInput({
  value,
  onChange,
  defaultCountryCode,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  defaultCountryCode: string;
  placeholder?: string;
}) {
  const fallback = findCountry(defaultCountryCode);
  const initial = splitValue(value, fallback);
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);

  function emit(nextCountry: Country, nextNational: string) {
    // A leading 0 is the national trunk prefix ("0501234567"), dropped
    // when combined with the country code — same as how Amazon/noon-style
    // inputs normalize this.
    const digits = nextNational.replace(/\D/g, "").replace(/^0+/, "");
    onChange(digits ? `${nextCountry.dial}${digits}` : "");
  }

  return (
    <div className="flex gap-2">
      <select
        value={country.code}
        onChange={(e) => {
          const next = findCountry(e.target.value);
          setCountry(next);
          emit(next, national);
        }}
        className="w-[108px] shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={national}
        placeholder={placeholder}
        onChange={(e) => {
          setNational(e.target.value);
          emit(country, e.target.value);
        }}
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
