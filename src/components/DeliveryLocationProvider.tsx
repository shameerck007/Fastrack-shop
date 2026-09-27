"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkZone, type ZoneVerdict } from "@/lib/delivery-geo";
import DeliveryLocationModal from "@/components/DeliveryLocationModal";
import {
  DeliveryCtx,
  type Ctx,
  type DeliveryLocation,
  type DeliveryStatus,
  type ZoneRow,
} from "@/components/delivery-location-context";

const STORAGE_KEY = "fastrack:delivery-location";
const SKIPPED_KEY = "fastrack:delivery-location-skipped";
// Pages where prompting a shopper for a delivery location makes no sense.
const NO_PROMPT_PREFIXES = ["/admin", "/rider", "/merchant", "/login", "/register", "/sell"];

function readStored(): DeliveryLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v.lat === "number" && typeof v.lng === "number" ? v : null;
  } catch {
    return null;
  }
}

export default function DeliveryLocationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [location, setLocationState] = useState<DeliveryLocation | null>(null);
  const [ready, setReady] = useState(false);
  const [zones, setZones] = useState<ZoneRow[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Restore the saved choice; if there is none but the shopper is signed in
  // with a pinned default address, start from that (like Instamart reusing
  // your last address).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStored();
      if (stored) {
        if (!cancelled) {
          setLocationState(stored);
          setReady(true);
        }
        return;
      }
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: addr } = await supabase
            .from("addresses")
            .select("id, label, address_line, district, city, lat, lng")
            .eq("user_id", user.id)
            .not("lat", "is", null)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled && addr && addr.lat != null && addr.lng != null) {
            const loc: DeliveryLocation = {
              lat: addr.lat,
              lng: addr.lng,
              label: addr.label.charAt(0).toUpperCase() + addr.label.slice(1),
              addressId: addr.id,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
            setLocationState(loc);
          }
        }
      } catch {
        /* browsing without a saved location is fine */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/delivery-zones")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ZoneRow[]) => {
        if (!cancelled) setZones(rows);
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // First visit with no location: ask for it, once per browser session.
  useEffect(() => {
    if (!ready || location) return;
    if (NO_PROMPT_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try {
      if (sessionStorage.getItem(SKIPPED_KEY)) return;
    } catch {
      /* ignore */
    }
    setPickerOpen(true);
  }, [ready, location, pathname]);

  const setLocation = useCallback((loc: DeliveryLocation) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
      /* ignore */
    }
    setLocationState(loc);
    setPickerOpen(false);
  }, []);

  const closePicker = useCallback(() => {
    try {
      sessionStorage.setItem(SKIPPED_KEY, "1");
    } catch {
      /* ignore */
    }
    setPickerOpen(false);
  }, []);

  const statusForStore = useCallback(
    (storeId: string | null): DeliveryStatus => {
      if (!zones) return { state: "loading" };
      const zone = zones.find((z) => z.storeId === storeId);
      // A store with no zone row (e.g. not yet approved) or no boundary is unrestricted.
      const verdict: ZoneVerdict = checkZone(zone, location);
      if (verdict.ok) return { state: "ok" };
      if (verdict.reason === "no_location") return { state: "no_location" };
      return { state: "outside", distanceKm: verdict.distanceKm, radiusKm: verdict.radiusKm };
    },
    [zones, location]
  );

  const serviceableAt = useCallback(
    (lat: number, lng: number): boolean | null => {
      if (!zones) return null;
      if (zones.length === 0) return true;
      return zones.some((z) => checkZone(z, { lat, lng }).ok);
    },
    [zones]
  );

  // Serviceable if at least one seller (incl. FasTrack's own stock) reaches here.
  const serviceable = useMemo(() => {
    if (!zones || !location) return null;
    if (zones.length === 0) return true;
    return zones.some((z) => checkZone(z, location).ok);
  }, [zones, location]);

  const value = useMemo<Ctx>(
    () => ({
      location,
      ready,
      serviceable,
      statusForStore,
      serviceableAt,
      setLocation,
      openPicker: () => setPickerOpen(true),
    }),
    [location, ready, serviceable, statusForStore, serviceableAt, setLocation]
  );

  return (
    <DeliveryCtx.Provider value={value}>
      {children}
      <DeliveryLocationModal open={pickerOpen} onClose={closePicker} />
    </DeliveryCtx.Provider>
  );
}
