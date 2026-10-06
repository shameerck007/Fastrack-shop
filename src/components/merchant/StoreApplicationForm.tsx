"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyForStore } from "@/lib/actions/merchant";
import DocumentUploader from "@/components/merchant/DocumentUploader";
import StoreProfileFields, { type StoreProfileValue } from "@/components/merchant/StoreProfileFields";
import TaxIdInput from "@/components/TaxIdInput";
import { checkCrNumber, checkVatNumber } from "@/lib/saudi-tax";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import BankFields from "@/components/merchant/BankFields";
import { validatePhone } from "@/lib/countries";
import { checkBankDetails } from "@/lib/saudi-banks";
import { checkSaudiIban, IBAN_PROBLEM_MESSAGES } from "@/lib/iban";
import { defaultOpeningHours } from "@/lib/store-hours";
import IndiaSupplierFields from "@/components/merchant/IndiaSupplierFields";
import { EMPTY_INDIA_SUPPLIER, validateIndiaSupplier } from "@/lib/india-business";
import { useMarket } from "@/components/MoneyProvider";

export default function StoreApplicationForm() {
  const { countryCode } = useMarket();
  const isIndia = countryCode === "IN";
  const [india, setIndia] = useState(EMPTY_INDIA_SUPPLIER);
  const [name, setName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [crDocumentPath, setCrDocumentPath] = useState<string | null>(null);
  const [vatDocumentPath, setVatDocumentPath] = useState<string | null>(null);
  const [profile, setProfile] = useState<StoreProfileValue>({
    logoUrl: null,
    coverUrl: null,
    tagline: "",
    hours: defaultOpeningHours(),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!crDocumentPath) {
      setError(isIndia ? "Please upload a copy of your GST registration certificate." : "Please upload a copy of your CR document.");
      return;
    }
    const phoneCheck = validatePhone(contactPhone);
    if (isIndia) {
      const problem = validateIndiaSupplier(india);
      if (problem) {
        setError(problem);
        return;
      }
      if (!phoneCheck.ok) {
        setError(phoneCheck.error);
        return;
      }
    } else {
      const crCheck = checkCrNumber(crNumber);
      if (!crCheck.ok) {
        setError(crCheck.error);
        return;
      }
      const vatCheck = checkVatNumber(vatNumber);
      if (!vatCheck.ok) {
        setError(vatCheck.error);
        return;
      }
      if (!phoneCheck.ok) {
        setError(phoneCheck.error);
        return;
      }
      const shape = checkSaudiIban(bankIban);
      if (!shape.ok) {
        setError(IBAN_PROBLEM_MESSAGES[shape.problem!]);
        return;
      }
      const bankCheck = checkBankDetails(bankName, bankIban);
      if (!bankCheck.ok) {
        setError(bankCheck.error);
        return;
      }
    }
    startTransition(async () => {
      try {
        await applyForStore({
          name,
          crNumber,
          vatNumber,
          contactPhone,
          bankName,
          bankIban,
          india: isIndia ? india : undefined,
          addressLine,
          crDocumentPath,
          vatDocumentPath: vatDocumentPath ?? undefined,
          logoUrl: profile.logoUrl,
          coverUrl: profile.coverUrl,
          tagline: profile.tagline,
          openingHours: profile.hours,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your application.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Store name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {isIndia ? (
        <IndiaSupplierFields value={india} onChange={setIndia} />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">CR number *</label>
          <TaxIdInput required value={crNumber} onChange={setCrNumber} check={checkCrNumber} length={10} placeholder="10 digits" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">VAT number</label>
          <TaxIdInput value={vatNumber} onChange={setVatNumber} check={checkVatNumber} length={15} placeholder="15 digits (optional)" />
        </div>
      </div>
        </>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Contact phone</label>
        <PhoneNumberInput required value={contactPhone} onChange={setContactPhone} placeholder={isIndia ? "98XXXXXXXX" : "5X XXX XXXX"} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Pickup address</label>
        <input
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="Where riders will collect orders from"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {!isIndia && (
        <BankFields value={{ bankName, iban: bankIban }} onChange={(v) => { setBankName(v.bankName); setBankIban(v.iban); }} />
      )}

      <div className="mt-2 border-t border-neutral-100 pt-4">
        <p className="mb-3 text-sm font-semibold">Your shop page</p>
        <StoreProfileFields value={profile} onChange={setProfile} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DocumentUploader
          label={isIndia ? "GST registration certificate *" : "CR document copy *"}
          kind="cr"
          value={crDocumentPath}
          onChange={setCrDocumentPath}
        />
        <DocumentUploader
          label={isIndia ? "PAN card copy" : "VAT certificate copy"}
          kind="vat"
          value={vatDocumentPath}
          onChange={setVatDocumentPath}
        />
      </div>
      <p className="text-xs text-neutral-400">
        PDF or image, up to 10 MB. Used by FasTrack to verify your business before approval.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
