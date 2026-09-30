"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setDefaultAddress } from "@/lib/actions/addresses";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import AddressForm from "@/components/AddressForm";
import type { AddressLabel } from "@/types/database";

interface SavedAddress {
  id: string;
  label: AddressLabel;
  address_line: string;
  district: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

const LABEL_ICON: Record<AddressLabel, string> = {
  home: "🏠",
  office: "💼",
  other: "📍",
};

/** Hard-gates listing pages (home, category, search) the moment the
 * shopper's current location is confirmed to be outside every seller's
 * delivery zone — Instamart-style: no products render at all rather than
 * showing a dismissible banner over a catalog they can't actually order
 * from. Lets them switch straight to a saved address that is deliverable,
 * or add and verify a new one, without leaving the page. */
export default function DeliveryGate({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const { location, serviceable, ready, serviceableAt, setLocation, openPicker } = useDeliveryLocation();
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);

  const blocked = ready && !!location && serviceable === false;

  useEffect(() => {
    if (!blocked) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setAddresses([]);
        return;
      }
      const { data } = await supabase
        .from("addresses")
        .select("id, label, address_line, district, city, lat, lng")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (!cancelled) setAddresses((data ?? []) as SavedAddress[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [blocked]);

  function switchToAddress(a: SavedAddress) {
    if (a.lat == null || a.lng == null) return;
    const labelText = a.label.charAt(0).toUpperCase() + a.label.slice(1);
    setLocation({ lat: a.lat, lng: a.lng, label: labelText, addressId: a.id });
    setDefaultAddress(a.id).catch(() => {});
  }

  if (!blocked) return <>{children}</>;

  const deliverableAddresses = (addresses ?? []).filter(
    (a) => a.lat != null && a.lng != null && serviceableAt(a.lat, a.lng) === true
  );
  const otherAddresses = (addresses ?? []).filter((a) => !deliverableAddresses.includes(a));

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <p className="mb-2 text-4xl">📍</p>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">
        {t("common.dont_deliver_banner", { location: location?.label ?? "" })}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">{t("common.dont_deliver_banner_hint")}</p>

      {addresses === null ? (
        <p className="text-sm text-neutral-400">{t("common.loading")}</p>
      ) : (
        <>
          {deliverableAddresses.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 text-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {t("common.deliverable_saved_addresses")}
              </p>
              {deliverableAddresses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => switchToAddress(a)}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-start text-sm hover:bg-emerald-100"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base">
                    {LABEL_ICON[a.label] ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium capitalize text-neutral-900">{a.label}</span>{" "}
                    <span className="text-emerald-700">✓ {t("common.we_deliver_here")}</span>
                    <span className="block truncate text-neutral-500">{a.address_line}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {otherAddresses.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 text-start opacity-60">
              {otherAddresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-start text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base">
                    {LABEL_ICON[a.label] ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium capitalize text-neutral-900">{a.label}</span>{" "}
                    <span className="text-red-600">{t("common.not_serviceable")}</span>
                    <span className="block truncate text-neutral-500">{a.address_line}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <AddressForm triggerLabel={t("common.add_and_verify_address")} />
            <button onClick={openPicker} className="text-sm text-blue-600 hover:underline">
              {t("common.change_location")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
