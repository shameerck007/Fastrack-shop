"use client";

import { useState } from "react";
import BankPicker from "@/components/merchant/BankPicker";
import {
  INDIAN_BANKS,
  OTHER_INDIAN_BANK,
  checkBankAccountNumber,
  checkFssai,
  checkGstin,
  checkIfsc,
  checkIndianBankDetails,
  checkPan,
  findIndianBank,
  type CodeCheck,
  type IndiaSupplierValue,
} from "@/lib/india-business";
import { INDIAN_STATES } from "@/lib/india";
import Select from "@/components/ui/Select";

const inputClass = "w-full min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/** Alphanumeric identifier box: uppercases, strips punctuation, and shows a live tick or reason. */
function CodeInput({
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

/** India supplier identity and payout details: GSTIN, PAN, FSSAI, state, and bank account with IFSC. */
export default function IndiaSupplierFields({
  value,
  onChange,
}: {
  value: IndiaSupplierValue;
  onChange: (next: IndiaSupplierValue) => void;
}) {
  const set = (patch: Partial<IndiaSupplierValue>) => onChange({ ...value, ...patch });
  const gstin = value.gstin.length === 15 ? checkGstin(value.gstin) : null;
  const bank = findIndianBank(value.bankName);
  const isOther = !!value.bankName && !bank;
  const [otherName, setOtherName] = useState(isOther ? value.bankName : "");
  const [choice, setChoice] = useState(isOther ? OTHER_INDIAN_BANK : value.bankName);

  const stateMismatch = gstin?.ok && value.state && gstin.stateName !== value.state;
  const panMismatch = gstin?.ok && value.pan.length === 10 && checkPan(value.pan).ok && gstin.pan !== value.pan;
  const ifscBankMismatch =
    bank && value.ifsc.length === 11 && checkIfsc(value.ifsc).ok && !bank.ifscPrefixes.includes(value.ifsc.slice(0, 4));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">GSTIN *</label>
          <CodeInput
            value={value.gstin}
            maxLength={15}
            placeholder="27ABCDE1234F1Z5"
            check={checkGstin}
            onChange={(v) => {
              const parsed = v.length === 15 ? checkGstin(v) : null;
              // A valid GSTIN already contains the PAN and the state: fill them in.
              set({
                gstin: v,
                ...(parsed?.ok ? { pan: value.pan || (parsed.pan ?? ""), state: value.state || (parsed.stateName ?? "") } : {}),
              });
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">PAN *</label>
          <CodeInput value={value.pan} maxLength={10} placeholder="ABCDE1234F" check={checkPan} onChange={(v) => set({ pan: v })} />
          {panMismatch && <p className="mt-1 text-xs text-red-600">This PAN doesn&apos;t match the PAN inside the GSTIN.</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">FSSAI licence number</label>
        <CodeInput value={value.fssai} maxLength={14} placeholder="14 digits" numericOnly check={checkFssai} onChange={(v) => set({ fssai: v })} />
        <p className="mt-1 text-[11px] text-neutral-400">Required by law for anyone selling food. Leave empty if you only sell non-food items.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">State *</label>
          <Select value={value.state} onChange={(e) => set({ state: e.target.value })} className={`${inputClass} bg-white`}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </Select>
          {stateMismatch && <p className="mt-1 text-xs text-red-600">Your GSTIN is registered in {gstin?.stateName}.</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Town / city *</label>
          <input value={value.city} onChange={(e) => set({ city: e.target.value })} className={inputClass} />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-3">
        <p className="mb-2 text-sm font-semibold">Bank account for payouts</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Bank *</label>
            <BankPicker
              value={choice}
              banks={INDIAN_BANKS}
              otherLabel={OTHER_INDIAN_BANK}
              onPick={(name) => {
                setChoice(name);
                set({ bankName: name === OTHER_INDIAN_BANK ? otherName.trim() : name });
              }}
            />
            {choice === OTHER_INDIAN_BANK && (
              <input
                value={otherName}
                onChange={(e) => {
                  setOtherName(e.target.value);
                  set({ bankName: e.target.value.trim() });
                }}
                placeholder="Bank name"
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Account holder name *</label>
            <input value={value.accountHolder} onChange={(e) => set({ accountHolder: e.target.value })} className={inputClass} />
            <p className="mt-1 text-[11px] text-neutral-400">As written on the bank account.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Account number *</label>
              <CodeInput
                value={value.accountNumber}
                maxLength={18}
                placeholder="9 to 18 digits"
                numericOnly
                check={checkBankAccountNumber}
                onChange={(v) => set({ accountNumber: v })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">IFSC *</label>
              <CodeInput value={value.ifsc} maxLength={11} placeholder="HDFC0001234" check={checkIfsc} onChange={(v) => set({ ifsc: v })} />
              {ifscBankMismatch && bank && (
                <p className="mt-1 text-xs text-red-600">This IFSC doesn&apos;t belong to {bank.name}.</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-neutral-400">Your settlement payouts are sent to this account. Copy the details from your cheque book or bank app.</p>
        </div>
      </div>
    </div>
  );
}
