"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAddress, updateAddress, type AddressInput } from "@/lib/actions/addresses";
import LocationPicker from "@/components/LocationPicker";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import type { Address, AddressLabel } from "@/types/database";

export default function AddressForm({
  existing,
  onDone,
  onAdded,
  triggerLabel = "Add new address",
}: {
  existing?: Address;
  onDone?: () => void;
  onAdded?: (addressId: string) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<AddressLabel>(existing?.label ?? "home");
  const [addressLine, setAddressLine] = useState(existing?.address_line ?? "");
  const [city, setCity] = useState(existing?.city ?? "Riyadh");
  const [district, setDistrict] = useState(existing?.district ?? "");
  const [buildingNumber, setBuildingNumber] = useState(existing?.building_number ?? "");
  const [additionalNumber, setAdditionalNumber] = useState(existing?.additional_number ?? "");
  const [unitNumber, setUnitNumber] = useState(existing?.unit_number ?? "");
  const [postalCode, setPostalCode] = useState(existing?.postal_code ?? "");
  const [shortAddress, setShortAddress] = useState(existing?.short_address ?? "");
  const [receiverName, setReceiverName] = useState(existing?.receiver_name ?? "");
  const [receiverPhone, setReceiverPhone] = useState(existing?.receiver_phone ?? "");
  const [lat, setLat] = useState<number | null>(existing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(existing?.lng ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Prefill a brand-new address with the account holder's name/phone
  // (they can change it if the order is for someone else).
  useEffect(() => {
    if (existing || !open) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !profile) return;
      setReceiverName((v) => v || profile.full_name || "");
      setReceiverPhone((v) => v || profile.phone || "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, existing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!receiverName.trim()) {
      setError("Enter the receiver's name.");
      return;
    }
    if (!/^[+\d][\d\s-]{7,15}$/.test(receiverPhone.trim())) {
      setError("Enter a valid receiver mobile number (e.g. 05XXXXXXXX or +9665XXXXXXXX).");
      return;
    }
    if (!addressLine.trim()) {
      setError("Add a short description (e.g. villa/apartment, street).");
      return;
    }
    const input: AddressInput = {
      label,
      addressLine: addressLine.trim(),
      city: city.trim(),
      district: district.trim() || undefined,
      buildingNumber: buildingNumber.trim() || undefined,
      additionalNumber: additionalNumber.trim() || undefined,
      unitNumber: unitNumber.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      shortAddress: shortAddress.trim() || undefined,
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    };
    startTransition(async () => {
      try {
        if (existing) {
          await updateAddress(existing.id, input);
          onDone?.();
        } else {
          const newId = await addAddress(input);
          onAdded?.(newId);
          setAddressLine("");
          setDistrict("");
          setBuildingNumber("");
          setAdditionalNumber("");
          setUnitNumber("");
          setPostalCode("");
          setShortAddress("");
          setReceiverName("");
          setReceiverPhone("");
          setLat(null);
          setLng(null);
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save address.");
      }
    });
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

      <LocationPicker
        lat={lat}
        lng={lng}
        onChange={(newLat, newLng) => {
          setLat(newLat);
          setLng(newLng);
        }}
      />

      <p className="text-xs font-medium text-neutral-500">Who will receive the order?</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          placeholder="Receiver's full name"
          autoComplete="name"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={receiverPhone}
          onChange={(e) => setReceiverPhone(e.target.value)}
          placeholder="Receiver's mobile (05XXXXXXXX)"
          inputMode="tel"
          autoComplete="tel"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <input
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        placeholder="Address description (e.g. Villa 12, near Al Nakheel Mall)"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      <p className="text-xs font-medium text-neutral-500">National Address details (optional but speeds up delivery)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="District"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Postal code"
          inputMode="numeric"
          maxLength={5}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={buildingNumber}
          onChange={(e) => setBuildingNumber(e.target.value)}
          placeholder="Building no."
          inputMode="numeric"
          maxLength={4}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={additionalNumber}
          onChange={(e) => setAdditionalNumber(e.target.value)}
          placeholder="Additional no."
          inputMode="numeric"
          maxLength={4}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          placeholder="Unit / apt no. (optional)"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <input
        value={shortAddress}
        onChange={(e) => setShortAddress(e.target.value.toUpperCase())}
        placeholder="Short address code (e.g. RRRD2929) — optional"
        maxLength={8}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : existing ? "Save changes" : "Save address"}
        </button>
        <button
          type="button"
          onClick={() => (existing ? onDone?.() : setOpen(false))}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (existing) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4">{formBody}</div>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <span className="text-base leading-none">+</span> {triggerLabel}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a new address">
        {formBody}
      </Modal>
    </>
  );
}
