"use client";

import { useState } from "react";
import BankPicker from "@/components/merchant/BankPicker";
import CodeInput from "@/components/CodeInput";
import {
  INDIAN_BANKS,
  OTHER_INDIAN_BANK,
  checkBankAccountNumber,
  checkIfsc,
  findIndianBank,
} from "@/lib/india-business";

export interface IndianBankValue {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
}

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Indian bank account for payouts: searchable bank, account holder, account number and IFSC (checked against the bank). */
export default function IndianBankFields({ value, onChange }: { value: IndianBankValue; onChange: (next: IndianBankValue) => void }) {
  const set = (patch: Partial<IndianBankValue>) => onChange({ ...value, ...patch });
  const bank = findIndianBank(value.bankName);
  const isOther = !!value.bankName && !bank;
  const [otherName, setOtherName] = useState(isOther ? value.bankName : "");
  const [choice, setChoice] = useState(isOther ? OTHER_INDIAN_BANK : value.bankName);
  const ifscBankMismatch =
    bank && value.ifsc.length === 11 && checkIfsc(value.ifsc).ok && !bank.ifscPrefixes.includes(value.ifsc.slice(0, 4));

  return (
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
          {ifscBankMismatch && bank && <p className="mt-1 text-xs text-red-600">This IFSC doesn&apos;t belong to {bank.name}.</p>}
        </div>
      </div>
    </div>
  );
}
