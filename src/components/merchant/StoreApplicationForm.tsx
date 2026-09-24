"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyForStore } from "@/lib/actions/merchant";

export default function StoreApplicationForm() {
  const [name, setName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await applyForStore({
          name,
          crNumber,
          vatNumber,
          contactPhone,
          bankName,
          bankIban,
          addressLine,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your application.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Store name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">CR number *</label>
          <input
            required
            value={crNumber}
            onChange={(e) => setCrNumber(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">VAT number</label>
          <input
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Contact phone</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+966..."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Bank name</label>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">IBAN</label>
          <input
            value={bankIban}
            onChange={(e) => setBankIban(e.target.value)}
            placeholder="For settlement payouts"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

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
