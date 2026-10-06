"use client";

import { useMemo, useState } from "react";
import BankPicker from "@/components/merchant/BankPicker";
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
          banks={SAUDI_BANKS}
          otherLabel={OTHER_BANK}
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
