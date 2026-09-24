"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAddress } from "@/lib/actions/addresses";
import type { AddressLabel } from "@/types/database";

export default function AddressForm() {
  const [label, setLabel] = useState<AddressLabel>("home");
  const [addressLine, setAddressLine] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addressLine.trim()) return;
    startTransition(async () => {
      await addAddress({ label, addressLine: addressLine.trim() });
      setAddressLine("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex gap-2">
        {(["home", "office", "other"] as AddressLabel[]).map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setLabel(l)}
            className={`rounded-full border px-3 py-1 text-sm capitalize ${
              label === l ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <input
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        placeholder="Building, street, district"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save address"}
      </button>
    </form>
  );
}
