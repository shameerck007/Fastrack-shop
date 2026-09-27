"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import LocationPicker from "@/components/LocationPicker";
import { createClient } from "@/lib/supabase/client";
import { setDefaultAddress } from "@/lib/actions/addresses";
import { reverseAreaName } from "@/lib/map-config";
import { useDeliveryLocation } from "@/components/delivery-location-context";

interface SavedAddress {
  id: string;
  label: string;
  address_line: string;
  district: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export default function DeliveryLocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { location, setLocation, serviceableAt } = useDeliveryLocation();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
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
      setError("Location isn't supported on this device — pick it on the map instead.");
      setShowMap(true);
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
        setError("Couldn't get your location. Allow location access for this site, or pick it on the map.");
        setShowMap(true);
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

  async function confirmPin() {
    if (!pin) return;
    setSaving(true);
    const label = await reverseAreaName(pin.lat, pin.lng);
    setSaving(false);
    setLocation({ lat: pin.lat, lng: pin.lng, label });
  }

  const pinServiceable = pin ? serviceableAt(pin.lat, pin.lng) : null;

  return (
    <Modal open={open} onClose={onClose} title="Choose your delivery location">
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <p className="text-sm text-neutral-500">
          We show what can be delivered to you based on where you are. Pick a location to get started.
        </p>

        <button
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          📍 {locating ? "Detecting your location..." : "Use my current location"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {addresses.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-neutral-400">Your saved addresses</p>
            {addresses.map((a) => {
              const pinned = a.lat != null && a.lng != null;
              const ok = pinned ? serviceableAt(a.lat as number, a.lng as number) : null;
              const selected = location?.addressId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => chooseAddress(a)}
                  disabled={!pinned}
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-blue-600 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <span>
                    <span className="font-medium capitalize">{a.label}</span>
                    <span className="block text-neutral-600">{a.address_line}</span>
                    <span className="block text-xs text-neutral-400">
                      {[a.district, a.city].filter(Boolean).join(", ")}
                      {!pinned && " · no map pin — edit it in Addresses"}
                    </span>
                  </span>
                  {ok === true && <span className="shrink-0 text-xs font-medium text-emerald-600">✓ Deliverable</span>}
                  {ok === false && <span className="shrink-0 text-xs font-medium text-red-600">✕ Not serviceable</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-neutral-100 pt-3">
          {!showMap ? (
            <button onClick={() => setShowMap(true)} className="text-sm font-medium text-blue-700 hover:underline">
              Or pick a location on the map →
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <LocationPicker lat={pin?.lat ?? null} lng={pin?.lng ?? null} onChange={(lat, lng) => setPin({ lat, lng })} />
              {pin && pinServiceable === true && (
                <p className="text-sm font-medium text-emerald-600">✓ We deliver to this location</p>
              )}
              {pin && pinServiceable === false && (
                <p className="text-sm font-medium text-red-600">
                  ✕ Sorry, we don&apos;t deliver here yet. You can still browse, but items can&apos;t be ordered.
                </p>
              )}
              <button
                onClick={confirmPin}
                disabled={!pin || saving}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {saving ? "Saving..." : "Confirm this location"}
              </button>
            </div>
          )}
        </div>

        {!location && (
          <button onClick={onClose} className="text-center text-xs text-neutral-400 hover:underline">
            Skip for now — I&apos;m just browsing
          </button>
        )}
      </div>
    </Modal>
  );
}
