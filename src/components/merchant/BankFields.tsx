"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkSaudiIban, formatIban, IBAN_PROBLEM_MESSAGES, normalizeIban } from "@/lib/iban";
import { OTHER_BANK, SAUDI_BANKS, bankForCode, checkBankDetails, findBank } from "@/lib/saudi-banks";

export interface BankValue {
  /** Name stored in stores.bank_name (a listed bank, or the typed name for "Other"). */
  bankName: string;
  /** Normalized IBAN, no spaces. */
  iban: string;
}

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Bank picker + IBAN input that validates as you type: exact Saudi format,
 * the checksum, and that the bank code inside the IBAN is the chosen bank's.
 * Payouts are sent to this account, so it won't let a wrong number through. */
export default function BankFields({
  value,
  onChange,
}: {
  value: BankValue;
  onChange: (next: BankValue) => void;
}) {
  const initiallyOther = !!value.bankName && !findBank(value.bankName);
  const [choice, setChoice] = useState(initiallyOther ? OTHER_BANK : value.bankName);
  const [otherName, setOtherName] = useState(initiallyOther ? value.bankName : "");
  const [touched, setTouched] = useState(false);
  const [ibanText, setIbanText] = useState(value.iban ? formatIban(value.iban) : "");

  const effectiveBank = choice === OTHER_BANK ? otherName.trim() : choice;

  const verdict = useMemo(() => {
    const raw = normalizeIban(ibanText);
    if (!raw) return { state: "empty" as const, message: "" };
    const shape = checkSaudiIban(raw);
    if (!shape.ok) {
      // Don't scold while they're still typing: only report once the length is reached or they leave the field.
      const complete = raw.length >= 24;
      return touched || complete
        ? { state: "bad" as const, message: IBAN_PROBLEM_MESSAGES[shape.problem!] }
        : { state: "typing" as const, message: "" };
    }
    const bankCheck = checkBankDetails(effectiveBank, raw);
    if (!bankCheck.ok) return { state: "bad" as const, message: bankCheck.error ?? "" };
    const detected = bankForCode(shape.bankCode);
    return { state: "good" as const, message: detected ? `Valid IBAN · ${detected.name}` : "Valid IBAN" };
  }, [ibanText, effectiveBank, touched]);

  function update(nextChoice: string, nextOther: string, nextIbanText: string) {
    const bank = nextChoice === OTHER_BANK ? nextOther.trim() : nextChoice;
    onChange({ bankName: bank, iban: normalizeIban(nextIbanText) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Bank *</label>
        <BankPicker
          value={choice}
          onPick={(name) => {
            setChoice(name);
            update(name, otherName, ibanText);
          }}
        />
        {choice === OTHER_BANK && (
          <input
            value={otherName}
            onChange={(e) => {
              setOtherName(e.target.value);
              update(choice, e.target.value, ibanText);
            }}
            placeholder="Bank name"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">IBAN *</label>
        <input
          value={ibanText}
          onChange={(e) => {
            const formatted = formatIban(e.target.value.slice(0, 40));
            setIbanText(formatted);
            update(choice, otherName, formatted);
          }}
          onBlur={() => setTouched(true)}
          placeholder="SA00 0000 0000 0000 0000 0000"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono tracking-wide ${
            verdict.state === "bad" ? "border-red-400" : verdict.state === "good" ? "border-emerald-400" : ""
          }`}
        />
        {verdict.state === "bad" && <p className="mt-1 text-xs text-red-600">{verdict.message}</p>}
        {verdict.state === "good" && <p className="mt-1 text-xs text-emerald-600">✓ {verdict.message}</p>}
        {(verdict.state === "empty" || verdict.state === "typing") && (
          <p className="mt-1 text-xs text-neutral-400">
            Your settlement payouts are sent to this account — copy the IBAN from your bank app or bank letter.
          </p>
        )}
      </div>
    </div>
  );
}

/** Searchable bank dropdown: type English or Arabic to filter. */
function BankPicker({ value, onPick }: { value: string; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = SAUDI_BANKS.filter((b) => !q || b.name.toLowerCase().includes(q) || b.nameAr.includes(q));
  const showOther = !q || OTHER_BANK.toLowerCase().includes(q) || "other".includes(q);

  function pick(name: string) {
    onPick(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between bg-white text-left ${open ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
      >
        <span className={value ? "" : "text-neutral-400"}>{value || "Select your bank"}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bank…  ابحث عن البنك"
              className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {matches.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={b.name === value}
                  onClick={() => pick(b.name)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 ${b.name === value ? "bg-blue-50 font-medium text-blue-700" : ""}`}
                >
                  <span>{b.name}</span>
                  <span className="text-xs text-neutral-400" dir="rtl">{b.nameAr}</span>
                </button>
              </li>
            ))}
            {showOther && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(OTHER_BANK)}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-600 hover:bg-blue-50"
                >
                  Other bank (type the name)
                </button>
              </li>
            )}
            {matches.length === 0 && !showOther && <li className="px-3 py-3 text-sm text-neutral-400">No bank found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
