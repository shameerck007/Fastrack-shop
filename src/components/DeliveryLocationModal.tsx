"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LocationPicker from "@/components/LocationPicker";
import PlaceSearch from "@/components/PlaceSearch";
import { createClient } from "@/lib/supabase/client";
import { setDefaultAddress } from "@/lib/actions/addresses";
import { reverseAreaName, type PlaceResult } from "@/lib/map-config";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { AddressLabel } from "@/types/database";

interface SavedAddress {
  id: string;
  label: AddressLabel;
  address_line: string;
  district: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

const LABEL_ICON: Record<AddressLabel, string> = {
  home: "🏠",
  office: "💼",
  other: "📍",
};

export default function DeliveryLocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { location, setLocation, serviceableAt } = useDeliveryLocation();
  const router = useRouter();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowAddNew(false);
    setPin(null);
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("addresses")
        .select("id, label, address_line, district, city, lat, lng, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (!cancelled) setAddresses((data ?? []) as SavedAddress[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't supported on this device — search or add an address instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseAreaName(latitude, longitude);
        setLocating(false);
        setLocation({ lat: latitude, lng: longitude, label });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Allow location access, or search / add an address.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function chooseAddress(a: SavedAddress) {
    if (a.lat == null || a.lng == null) return;
    setLocation({ lat: a.lat, lng: a.lng, label: a.district || a.city || a.label, addressId: a.id });
    // Keep the server-side default in step so add-to-cart checks agree.
    setDefaultAddress(a.id).catch(() => {});
  }

  async function pickSearchResult(place: PlaceResult) {
    setLocation({ lat: place.lat, lng: place.lng, label: place.label });
  }

  async function confirmPin() {
    if (!pin) return;
    setSaving(true);
    const label = await reverseAreaName(pin.lat, pin.lng);
    setSaving(false);
    setLocation({ lat: pin.lat, lng: pin.lng, label });
  }

  if (!open) return null;

  const pinServiceable = pin ? serviceableAt(pin.lat, pin.lng) : null;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-neutral-600 hover:bg-neutral-100"
        >
          ←
        </button>
        <h1 className="text-base font-semibold text-neutral-900">Select your location</h1>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
        <PlaceSearch onSelect={pickSearchResult} placeholder="Search an area or address" />

        <div className="flex gap-2">
          <button
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-2.5 text-[13px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:gap-2 sm:px-3 sm:text-sm"
          >
            <span aria-hidden>🧭</span>
            {locating ? "Detecting…" : "Current Location"}
          </button>
          <button
            onClick={() => setShowAddNew((v) => !v)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-2.5 text-[13px] font-medium sm:gap-2 sm:px-3 sm:text-sm ${
              showAddNew
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <span aria-hidden>{showAddNew ? "✕" : "＋"}</span>
            {showAddNew ? "Cancel" : "Add New Address"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {showAddNew && (
          <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-3">
            <LocationPicker lat={pin?.lat ?? null} lng={pin?.lng ?? null} onChange={(lat, lng) => setPin({ lat, lng })} />
            {pin && pinServiceable === true && (
              <p className="text-sm font-medium text-emerald-600">✓ We deliver to this location</p>
            )}
            {pin && pinServiceable === false && (
              <p className="text-sm font-medium text-red-600">
                Sorry, we don&apos;t deliver here yet — you can still browse, but items can&apos;t be ordered.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmPin}
                disabled={!pin || saving}
                className="flex-1 rounded-full bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Use this location"}
              </button>
              <button
                onClick={() => {
                  onClose();
                  router.push("/addresses");
                }}
                className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Save as address
              </button>
            </div>
          </div>
        )}

        {addresses.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Saved addresses</p>
            {addresses.map((a) => {
              const pinned = a.lat != null && a.lng != null;
              const ok = pinned ? serviceableAt(a.lat as number, a.lng as number) : null;
              const selected = location?.addressId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => chooseAddress(a)}
                  disabled={!pinned}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-blue-600 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base">
                    {LABEL_ICON[a.label] ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium capitalize text-neutral-900">{a.label}</span>
                      {ok === false && (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          Not serviceable
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-neutral-500">{a.address_line}</span>
                    <span className="block truncate text-xs text-neutral-400">
                      {[a.district, a.city].filter(Boolean).join(", ")}
                      {!pinned && " · no map pin — edit it in Addresses"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!location && (
          <button onClick={onClose} className="pb-2 text-center text-xs text-neutral-400 hover:underline">
            Skip for now — I&apos;m just browsing
          </button>
        )}
      </div>
    </div>
  );
}
