"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { methodsFor, type DeliveryZone } from "@/lib/delivery-methods";
import { DEFAULT_ETA_SETTINGS, etaRange, fastestEta, slowestEta, type EtaRange, type EtaSettings } from "@/lib/eta";
import { distanceKm as kmBetween } from "@/lib/delivery-geo";
import { reverseAreaName } from "@/lib/map-config";
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
const GPS_REFRESHED_KEY = "fastrack:gps-refreshed";
// Pages where prompting a shopper for a delivery location makes no sense.
function toZone(z: ZoneRow): DeliveryZone {
  return {
    lat: z.lat,
    lng: z.lng,
    expressRadiusKm: z.radiusKm,
    standardEnabled: z.standardEnabled,
    standardRadiusKm: z.standardRadiusKm,
    standardDays: z.standardDays,
    polygon: z.polygon ?? null,
  };
}

const NO_PROMPT_PREFIXES = ["/admin", "/platform", "/rider", "/merchant", "/store", "/warehouse", "/login", "/register", "/sell"];

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

export default function DeliveryLocationProvider({ children, eta = DEFAULT_ETA_SETTINGS }: { children: React.ReactNode; eta?: EtaSettings }) {
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

  // First visit with no location: detect it automatically instead of
  // interrupting the shopper with a full-screen picker (Swiggy/Instamart
  // style). The browser's own small native permission prompt is the only
  // thing shown — if that's granted we resolve a place name silently and
  // the shopper lands straight on the storefront. Only when detection
  // fails (denied, unsupported, or timed out) do we fall back to the
  // manual picker so they always have a way forward.
  useEffect(() => {
    if (!ready || location) return;
    if (NO_PROMPT_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try {
      if (sessionStorage.getItem(SKIPPED_KEY)) return;
    } catch {
      /* ignore */
    }

    let cancelled = false;

    async function autoDetect() {
      if (!navigator.geolocation) {
        if (!cancelled) setPickerOpen(true);
        return;
      }
      // If the browser already remembers a denial, asking again would just
      // silently fail after the OS/browser's own cooldown — go straight to
      // the manual picker instead of making them wait on nothing.
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (cancelled) return;
          if (status.state === "denied") {
            setPickerOpen(true);
            return;
          }
        }
      } catch {
        /* Permissions API isn't available everywhere — fall through and just ask. */
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          try {
            const label = await reverseAreaName(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            if (!cancelled) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label, source: "gps" });
          } catch {
            if (!cancelled) setPickerOpen(true);
          }
        },
        () => {
          if (!cancelled) setPickerOpen(true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    autoDetect();
    return () => {
      cancelled = true;
    };
  }, [ready, location, pathname, setLocation]);

  // Returning visitor whose saved spot came from GPS: quietly re-check where
  // they are once per session so the header says where they are *now*
  // (a manually chosen address is never overridden). Only runs when the
  // browser already granted permission, so it never shows a prompt.
  useEffect(() => {
    if (!ready || location?.source !== "gps") return;
    try {
      if (sessionStorage.getItem(GPS_REFRESHED_KEY)) return;
      sessionStorage.setItem(GPS_REFRESHED_KEY, "1");
    } catch {
      return;
    }
    if (!navigator.geolocation || !navigator.permissions?.query) return;

    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (cancelled) return;
            const label = await reverseAreaName(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            if (!cancelled) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label, source: "gps" });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, location?.source, setLocation]);

  // Visibility rule: a seller's products are shown when Express OR Standard reaches the
  // shopper. The radius only decides Express; Standard is on by default with no distance limit.
  const statusForStore = useCallback(
    (storeId: string | null): DeliveryStatus => {
      if (!zones) return { state: "loading" };
      const candidates = zones.filter((z) => z.storeId === storeId);

      // A store/warehouse with no zone row at all (e.g. not yet approved) is unrestricted.
      if (candidates.length === 0) {
        return { state: "ok", express: true, standard: true, standardDays: 2, expressRadiusKm: null };
      }

      // storeId === null can match several FasTrack warehouses: offered if ANY of them offers it.
      let express = false;
      let standard = false;
      let days: number | null = null;
      let expressRadiusKm: number | null = null;
      let nearestOutside: { distanceKm: number; radiusKm: number } | null = null;
      let sawKnown = false;
      for (const zone of candidates) {
        const m = methodsFor(toZone(zone), location);
        if (m.state === "no_location") continue;
        sawKnown = true;
        if (m.express) {
          express = true;
          expressRadiusKm = m.expressRadiusKm;
        }
        if (m.standard) {
          standard = true;
          days = days == null ? m.standardDays : Math.min(days, m.standardDays);
        }
        if (!m.express && !m.standard && m.distanceKm != null) {
          const radius = (zone.standardEnabled ? zone.standardRadiusKm : zone.radiusKm) ?? zone.radiusKm ?? 0;
          if (!nearestOutside || m.distanceKm < nearestOutside.distanceKm) nearestOutside = { distanceKm: m.distanceKm, radiusKm: radius };
        }
      }
      if (!sawKnown) return { state: "no_location" };
      if (express || standard) return { state: "ok", express, standard, standardDays: days ?? 2, expressRadiusKm };
      return { state: "outside", ...(nearestOutside ?? { distanceKm: 0, radiusKm: 0 }) };
    },
    [zones, location]
  );

  // Is this location reached by anyone, by Express or Standard?
  const serviceableAt = useCallback(
    (lat: number, lng: number): boolean | null => {
      if (!zones) return null;
      if (zones.length === 0) return true;
      return zones.some((z) => {
        const m = methodsFor(toZone(z), { lat, lng });
        return m.state === "known" && (m.express || m.standard);
      });
    },
    [zones]
  );

  const serviceable = useMemo(() => {
    if (!zones || !location) return null;
    if (zones.length === 0) return true;
    return zones.some((z) => {
      const m = methodsFor(toZone(z), location);
      return m.state === "known" && (m.express || m.standard);
    });
  }, [zones, location]);

  // Express time for one seller at some coordinates: the nearest of its zones that offers Express there.
  const etaAtCoords = useCallback(
    (storeId: string | null, lat: number, lng: number): EtaRange | null => {
      if (!zones) return null;
      let best: number | null = null;
      for (const zone of zones.filter((z) => z.storeId === storeId)) {
        const m = methodsFor(toZone(zone), { lat, lng });
        if (m.state !== "known" || !m.express || zone.lat == null || zone.lng == null) continue;
        const d = kmBetween(zone.lat, zone.lng, lat, lng);
        if (best == null || d < best) best = d;
      }
      return best == null ? null : etaRange(best, eta);
    },
    [zones, eta]
  );

  const etaForStore = useCallback(
    (storeId: string | null): EtaRange | null => (location ? etaAtCoords(storeId, location.lat, location.lng) : null),
    [etaAtCoords, location]
  );

  const bestEta = useCallback((): EtaRange | null => {
    if (!zones || !location) return null;
    const ids = [...new Set(zones.map((z) => z.storeId))];
    return fastestEta(ids.map((id) => etaAtCoords(id, location.lat, location.lng)));
  }, [zones, location, etaAtCoords]);

  const etaAt = useCallback(
    (lat: number, lng: number, storeIds: (string | null)[]): EtaRange | null =>
      slowestEta([...new Set(storeIds)].map((id) => etaAtCoords(id, lat, lng))),
    [etaAtCoords]
  );

  const value = useMemo<Ctx>(
    () => ({
      etaForStore,
      bestEta,
      etaAt,
      location,
      ready,
      serviceable,
      statusForStore,
      serviceableAt,
      setLocation,
      openPicker: () => setPickerOpen(true),
    }),
    [location, ready, serviceable, statusForStore, serviceableAt, setLocation, etaForStore, bestEta, etaAt]
  );

  return (
    <DeliveryCtx.Provider value={value}>
      {children}
      <DeliveryLocationModal open={pickerOpen} onClose={closePicker} />
    </DeliveryCtx.Provider>
  );
}
