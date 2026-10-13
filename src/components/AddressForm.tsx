"use client";

import { errorText, unwrapAction } from "@/lib/errors";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { validatePhone } from "@/lib/countries";
import { INDIAN_STATES, checkPinCode, pinMatchesState, serviceStatesFor, SERVICE_AREA_MESSAGE } from "@/lib/india";
import { useMarket } from "@/components/MoneyProvider";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAddress, updateAddress, type AddressInput } from "@/lib/actions/addresses";
import PinMap, { type MapTarget } from "@/components/PinMap";
import PlaceSearch from "@/components/PlaceSearch";
import { createClient } from "@/lib/supabase/client";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { reverseAreaName } from "@/lib/map-config";
import type { Address, AddressLabel } from "@/types/database";
import Select from "@/components/ui/Select";

const field =
  "min-h-[2.75rem] w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-500 hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const LABELS: { id: AddressLabel; icon: string }[] = [
  { id: "home", icon: "🏠" },
  { id: "office", icon: "🏢" },
  { id: "other", icon: "📍" },
];

function labelText(l: AddressLabel): string {
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/**
 * Add or edit an address the way Keeta and Noon Minutes do it: first drop the pin on a map (search, use my location, or drag the map
 * under the pin), then fill in the details (home, work or other, flat and building, who receives it). Full screen on a phone.
 */
export default function AddressForm({
  existing,
  onDone,
  onAdded,
  triggerLabel,
  variant = "pill",
}: {
  existing?: Address;
  onDone?: () => void;
  onAdded?: (addressId: string) => void;
  triggerLabel?: string;
  /** "tile" is a large dashed button for the top of the addresses page. */
  variant?: "pill" | "tile";
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(!!existing);
  const [step, setStep] = useState<"map" | "details">(existing?.lat != null && existing?.lng != null ? "details" : "map");
  const [label, setLabel] = useState<AddressLabel>(existing?.label ?? "home");
  const [addressLine, setAddressLine] = useState(existing?.address_line ?? "");
  const [addressTouched, setAddressTouched] = useState(!!existing);
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
  const [pinLabel, setPinLabel] = useState<string | null>(null);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { location: deliveryLocation, serviceableAt, setLocation } = useDeliveryLocation();
  const nonce = useRef(0);
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchedRef = useRef(addressTouched);
  useEffect(() => {
    touchedRef.current = addressTouched;
  }, [addressTouched]);

  // A brand-new address starts pinned at the shopper's chosen delivery location.
  const startLat = lat ?? deliveryLocation?.lat ?? null;
  const startLng = lng ?? deliveryLocation?.lng ?? null;

  // Prefill a brand-new address with the account holder's name and phone (they can change it if the order is for someone else).
  useEffect(() => {
    if (existing || !open) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
      if (cancelled || !profile) return;
      setReceiverName((v) => v || profile.full_name || "");
      setReceiverPhone((v) => v || profile.phone || "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, existing]);

  // The page behind does not scroll while the full-screen form is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Where the pin is: remember it, work out a readable name for the spot, and fill the address line with it until the shopper types their own.
  const onPinMove = useCallback((la: number, ln: number) => {
    setLat(la);
    setLng(ln);
    setPinLabel(null);
    if (labelTimer.current) clearTimeout(labelTimer.current);
    labelTimer.current = setTimeout(async () => {
      const name = await reverseAreaName(la, ln);
      setPinLabel(name);
      if (!touchedRef.current) setAddressLine(name === "Current location" ? "" : name);
    }, 450);
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError(t("common.geolocation_not_supported"));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        nonce.current += 1;
        setTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 18, nonce: nonce.current });
      },
      () => {
        setLocating(false);
        setError("We could not get your location. Allow location access, or search for the place.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function close() {
    if (existing) onDone?.();
    else setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lat == null || lng == null) {
      setError("Pin the delivery location on the map first.");
      setStep("map");
      return;
    }
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
      lat,
      lng,
    };
    startTransition(async () => {
      try {
        if (existing) {
          await unwrapAction(updateAddress)(existing.id, input);
          // The shopper's active shopping location follows the moved pin straight away.
          setLocation({ lat, lng, label: labelText(label), addressId: existing.id });
          onDone?.();
        } else {
          const newId = await unwrapAction(addAddress)(input);
          onAdded?.(newId);
          // A freshly added address becomes the active shopping location right away.
          setLocation({ lat, lng, label: labelText(label), addressId: newId });
          setAddressLine("");
          setAddressTouched(false);
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
          setStep("map");
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(errorText(err, t("addresses.could_not_save")));
      }
    });
  }

  const deliverable = lat != null && lng != null ? serviceableAt(lat, lng) : null;

  const mapStep = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {open && <PinMap lat={startLat} lng={startLng} onMove={onPinMove} target={target} />}
        <div className="absolute inset-x-0 top-0 z-[1000] flex items-start gap-2 p-3">
          <button type="button" onClick={close} aria-label={t("common.cancel")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-neutral-700 shadow-lg ring-1 ring-black/5 rtl:-scale-x-100">
            ←
          </button>
          <div className="min-w-0 flex-1 rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
            <PlaceSearch
              placeholder={t("common.search_an_area")}
              onSelect={(p) => {
                nonce.current += 1;
                setTarget({ lat: p.lat, lng: p.lng, zoom: 17, nonce: nonce.current });
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute bottom-4 end-3 z-[1000] flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-700 shadow-lg ring-1 ring-black/5 disabled:opacity-60"
        >
          <span aria-hidden>{locating ? "…" : "◎"}</span> {locating ? "Locating" : "My location"}
        </button>
      </div>
      <div className="relative z-[1000] rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Delivery location</p>
        <div className="mt-1 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base">📍</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-neutral-900">{pinLabel ?? "Finding the place…"}</p>
            {deliverable === true && <p className="text-sm font-medium text-emerald-600">{t("common.we_deliver_here")}</p>}
            {deliverable === false && <p className="text-sm font-medium text-red-600">{t("common.dont_deliver_here")}</p>}
            {deliverable === null && <p className="text-sm text-neutral-500">Move the map to place the pin on your door.</p>}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={() => setStep("details")} disabled={lat == null || pinLabel === null} className="mt-3 h-12 w-full rounded-full bg-brand-700 text-base font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:opacity-50">
          Confirm location
        </button>
      </div>
    </div>
  );

  const detailsStep = (
    <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 bg-white px-4 py-3">
        <button type="button" onClick={() => setStep("map")} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-neutral-700 hover:bg-neutral-100 rtl:-scale-x-100">
          ←
        </button>
        <h1 className="text-base font-extrabold text-neutral-900">{existing ? t("addresses.edit") : "Address details"}</h1>
        <button type="button" onClick={close} className="ms-auto text-sm font-medium text-neutral-500 hover:text-neutral-800">
          {t("common.cancel")}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4 pb-28">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg">📍</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-neutral-900">{pinLabel ?? (addressLine || "Pinned location")}</p>
            {deliverable === true && <p className="text-xs font-medium text-emerald-600">{t("common.we_deliver_here")}</p>}
            {deliverable === false && <p className="text-xs font-medium text-red-600">{t("common.dont_deliver_here")}</p>}
          </div>
          <button type="button" onClick={() => setStep("map")} className="shrink-0 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">
            Change
          </button>
        </div>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Save as</p>
          <div className="grid grid-cols-3 gap-2">
            {LABELS.map((l) => (
              <button
                type="button"
                key={l.id}
                onClick={() => setLabel(l.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-sm font-semibold transition ${label === l.id ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"}`}
              >
                <span className="text-2xl">{l.icon}</span>
                {t(`addresses.label_${l.id}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{isIndia ? t("address_in.title") : "Address"}</p>
          <input
            value={addressLine}
            onChange={(e) => {
              setAddressLine(e.target.value);
              setAddressTouched(true);
            }}
            placeholder={isIndia ? "Delivery note (e.g. Flat 4B, near the temple, gate code)" : t("addresses.address_description_placeholder")}
            className={field}
          />
          {isIndia ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder={t("address_in.flat")} className={field} />
              <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t("address_in.area")} className={field} />
              <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder={t("address_in.landmark")} className={`${field} sm:col-span-2`} />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("address_in.city")} className={field} />
              <Select value={stateName} onChange={(e) => setStateName(e.target.value)} className={field}>
                <option value="">{t("address_in.select_state")}</option>
                {stateOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </Select>
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t("address_in.pin")} inputMode="numeric" maxLength={6} className={field} />
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-500">{t("addresses.national_address_hint")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t("addresses.district_placeholder")} className={field} />
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("addresses.city_placeholder")} className={field} />
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("addresses.postal_code_placeholder")} inputMode="numeric" maxLength={5} className={field} />
                <input value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder={t("addresses.building_no_placeholder")} inputMode="numeric" maxLength={4} className={field} />
                <input value={additionalNumber} onChange={(e) => setAdditionalNumber(e.target.value)} placeholder={t("addresses.additional_no_placeholder")} inputMode="numeric" maxLength={4} className={field} />
                <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit / apt no." className={field} />
              </div>
              <input value={shortAddress} onChange={(e) => setShortAddress(e.target.value.toUpperCase())} placeholder="Short address code, e.g. RRRD2929" maxLength={8} className={field} />
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("addresses.who_receives")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder={t("addresses.receiver_name_placeholder")} autoComplete="name" className={field} />
            <PhoneNumberInput value={receiverPhone} onChange={setReceiverPhone} placeholder={isIndia ? "98XXXXXXXX" : t("addresses.receiver_phone_placeholder")} />
          </div>
        </section>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-neutral-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button type="submit" disabled={pending} className="h-12 w-full rounded-full bg-brand-700 text-base font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:opacity-50">
            {pending ? t("common.saving") : existing ? t("addresses.save_changes") : t("addresses.save_address")}
          </button>
        </div>
      </div>
    </form>
  );

  const overlay = open && (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-neutral-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {step === "map" ? mapStep : detailsStep}
    </div>
  );

  if (existing) return overlay || null;

  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 p-4 text-start transition hover:border-brand-500 hover:bg-brand-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xl font-light text-white">+</span>
          <span>
            <span className="block text-sm font-extrabold text-brand-900">{triggerLabel ?? t("addresses.add_new")}</span>
            <span className="block text-xs text-neutral-500">Pin it on the map, then add the details</span>
          </span>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800 hover:shadow-md">
          <span className="text-base leading-none">+</span> {triggerLabel ?? t("addresses.add_new")}
        </button>
      )}
      {overlay}
    </>
  );
}
