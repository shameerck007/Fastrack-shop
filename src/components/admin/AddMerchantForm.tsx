"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { findUserByEmail, adminCreateMerchant, type FoundUser } from "@/lib/actions/admin-merchants";

const COUNTRIES = ["Saudi Arabia", "United Arab Emirates", "Kuwait", "Bahrain", "Qatar", "Oman", "India"];

export default function AddMerchantForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = not searched yet
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("Riyadh");
  const [country, setCountry] = useState("Saudi Arabia");

  function reset() {
    setEmail("");
    setFound(undefined);
    setError(null);
    setName("");
    setCrNumber("");
    setVatNumber("");
    setContactPhone("");
    setAddressLine("");
    setCity("Riyadh");
    setCountry("Saudi Arabia");
  }

  function close() {
    setOpen(false);
    reset();
  }

  function search() {
    setError(null);
    startSearch(async () => {
      try {
        const user = await findUserByEmail(email);
        setFound(user);
        if (!user) setError("No account with that email — ask them to register first, then try again.");
        else if (user.hasStore) setError("This user already has a store.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lookup failed.");
      }
    });
  }

  function submit() {
    if (!found) return;
    if (!name.trim() || !crNumber.trim()) {
      setError("Store name and CR number are required.");
      return;
    }
    setError(null);
    startSave(async () => {
      try {
        const storeId = await adminCreateMerchant({
          ownerId: found.id,
          name: name.trim(),
          crNumber: crNumber.trim(),
          vatNumber: vatNumber.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
          city: city.trim() || "Riyadh",
          country,
        });
        close();
        router.push(`/admin/merchants/${storeId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the merchant.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
      >
        <span aria-hidden>＋</span> Add Merchant
      </button>

      <Modal open={open} onClose={close} title="Add merchant" size="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">
            The store owner must already have a registered account. Look them up by email, then fill in their
            store details — it goes live approved immediately, no application review needed.
          </p>

          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(undefined);
                setError(null);
              }}
              placeholder="owner@example.com"
              type="email"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              onClick={search}
              disabled={!email.trim() || searching}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {searching ? "Searching…" : "Find"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {found && !found.hasStore && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                ✓ Found: {found.fullName ?? "Unnamed account"} (currently {found.role})
              </p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Store name"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                  placeholder="CR number"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="VAT number (optional)"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Contact phone (optional)"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Address (optional)"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={submit}
                disabled={saving}
                className="mt-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create merchant"}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
