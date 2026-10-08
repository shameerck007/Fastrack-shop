"use client";

import PhoneNumberInput from "@/components/PhoneNumberInput";
import { validatePhone } from "@/lib/countries";
import { INDIAN_STATES, checkPinCode, pinMatchesState, serviceStatesFor, SERVICE_AREA_MESSAGE } from "@/lib/india";
import { useMarket } from "@/components/MoneyProvider";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAddress, updateAddress, type AddressInput } from "@/lib/actions/addresses";
import LocationPicker from "@/components/LocationPicker";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import type { Address, AddressLabel } from "@/types/database";
import Select from "@/components/ui/Select";

function labelText(l: AddressLabel): string {
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export default function AddressForm({
  existing,
  onDone,
  onAdded,
  triggerLabel,
}: {
  existing?: Address;
  onDone?: () => void;
  onAdded?: (addressId: string) => void;
  triggerLabel?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<AddressLabel>(existing?.label ?? "home");
  const [addressLine, setAddressLine] = useState(existing?.address_line ?? "");
  const { countryCode } = useMarket();
  const isIndia = countryCode === "IN";
  const [city, setCity] = useState(existing?.city ?? (isIndia ? "" : "Riyadh"));
  const stateOptions = isIndia ? serviceStatesFor(countryCode) ?? INDIAN_STATES : INDIAN_STATES;
  const [stateName, setStateName] = useState(existing?.state ?? (stateOptions.length === 1 ? stateOptions[0] : ""));
  const [landmark, setLandmark] = useState(existing?.landmark ?? "");
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
  const { location: deliveryLocation, serviceableAt, setLocation } = useDeliveryLocation();

  // A brand-new address starts pinned at the shopper's chosen delivery location.
  useEffect(() => {
    if (existing || !open || !deliveryLocation) return;
    setLat((v) => v ?? deliveryLocation.lat);
    setLng((v) => v ?? deliveryLocation.lng);
  }, [open, existing, deliveryLocation]);

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
      setError(t("addresses.enter_receiver_name"));
      return;
    }
    if (!validatePhone(receiverPhone.trim()).ok) {
      setError(t("addresses.enter_valid_phone"));
      return;
    }
    if (!addressLine.trim()) {
      setError(t("addresses.add_address_description"));
      return;
    }
    if (isIndia) {
      if (!city.trim()) {
        setError(t("address_in.enter_city"));
        return;
      }
      if (!stateName) {
        setError(t("address_in.choose_state"));
        return;
      }
      if (!stateOptions.includes(stateName)) {
        setError(SERVICE_AREA_MESSAGE);
        return;
      }
      const pin = checkPinCode(postalCode);
      if (!pin.ok) {
        setError(pin.error);
        return;
      }
      if (!pinMatchesState(stateName, pin.value)) {
        setError(`That PIN code doesn't look like a ${stateName} PIN code.`);
        return;
      }
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
      state: stateName || undefined,
      landmark: landmark.trim() || undefined,
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
          // If the pin moved, make sure the shopper's active shopping
          // location follows it immediately — otherwise the product grid
          // keeps filtering against the old coordinates until they happen
          // to reopen the location picker separately.
          if (lat != null && lng != null) {
            setLocation({ lat, lng, label: labelText(label), addressId: existing.id });
          }
          onDone?.();
        } else {
          const newId = await addAddress(input);
          onAdded?.(newId);
          // A freshly added, verified address becomes the active shopping
          // location right away — the whole point of adding it here is to
          // shop against this address's zone, not to save it and then need
          // a separate step to actually switch to it.
          if (lat != null && lng != null) {
            setLocation({ lat, lng, label: labelText(label), addressId: newId });
          }
          setAddressLine("");
          setDistrict("");
          setBuildingNumber("");
          setAdditionalNumber("");
          setUnitNumber("");
          setPostalCode("");
          setLandmark("");
          if (isIndia) setStateName(stateOptions.length === 1 ? stateOptions[0] : "");
          setShortAddress("");
          setReceiverName("");
          setReceiverPhone("");
          setLat(null);
          setLng(null);
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("addresses.could_not_save"));
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
            className={`rounded-full border px-3 py-1 text-sm ${
              label === l ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300"
            }`}
          >
            {t(`addresses.label_${l}`)}
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
      {lat != null && lng != null && (
        serviceableAt(lat, lng) === true ? (
          <p className="text-sm font-medium text-emerald-600">{t("common.we_deliver_here")}</p>
        ) : serviceableAt(lat, lng) === false ? (
          <p className="text-sm font-medium text-red-600">{t("common.dont_deliver_here")}</p>
        ) : null
      )}

      <p className="text-xs font-medium text-neutral-500">{t("addresses.who_receives")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          placeholder={t("addresses.receiver_name_placeholder")}
          autoComplete="name"
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <PhoneNumberInput value={receiverPhone} onChange={setReceiverPhone} placeholder={isIndia ? "98XXXXXXXX" : t("addresses.receiver_phone_placeholder")} />
      </div>

      <input
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        placeholder={isIndia ? "Delivery note (e.g. Flat 4B, near the temple, gate code)" : t("addresses.address_description_placeholder")}
        className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      {isIndia ? (
        <>
      <p className="text-xs font-medium text-neutral-500">{t("address_in.title")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={buildingNumber}
          onChange={(e) => setBuildingNumber(e.target.value)}
          placeholder={t("address_in.flat")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t("address_in.area")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder={t("address_in.landmark")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:col-span-2"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("address_in.city")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <Select
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">{t("address_in.select_state")}</option>
          {stateOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("address_in.pin")}
          inputMode="numeric"
          maxLength={6}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

        </>
      ) : (
        <>
      <p className="text-xs font-medium text-neutral-500">{t("addresses.national_address_hint")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t("addresses.district_placeholder")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("addresses.city_placeholder")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder={t("addresses.postal_code_placeholder")}
          inputMode="numeric"
          maxLength={5}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={buildingNumber}
          onChange={(e) => setBuildingNumber(e.target.value)}
          placeholder={t("addresses.building_no_placeholder")}
          inputMode="numeric"
          maxLength={4}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={additionalNumber}
          onChange={(e) => setAdditionalNumber(e.target.value)}
          placeholder={t("addresses.additional_no_placeholder")}
          inputMode="numeric"
          maxLength={4}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          placeholder={t("addresses.unit_no_placeholder")}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <input
        value={shortAddress}
        onChange={(e) => setShortAddress(e.target.value.toUpperCase())}
        placeholder={t("addresses.short_address_placeholder")}
        maxLength={8}
        className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
      />

        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("common.saving") : existing ? t("addresses.save_changes") : t("addresses.save_address")}
        </button>
        <button
          type="button"
          onClick={() => (existing ? onDone?.() : setOpen(false))}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100"
        >
          {t("common.cancel")}
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
        <span className="text-base leading-none">+</span> {triggerLabel ?? t("addresses.add_new")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("addresses.add_a_new_address")}>
        {formBody}
      </Modal>
    </>
  );
}
