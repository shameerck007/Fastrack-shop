"use client";

import { useEffect, useRef, useState } from "react";
import { updateRiderLocation } from "@/lib/actions/rider-location";

const MIN_UPDATE_INTERVAL_MS = 15000;

export default function RiderLocationTracker() {
  const [error, setError] = useState<string | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      const timer = setTimeout(() => setError("Geolocation isn't supported on this device."), 0);
      return () => clearTimeout(timer);
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAt.current < MIN_UPDATE_INTERVAL_MS) return;
        lastSentAt.current = now;
        updateRiderLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {
          // best-effort — a missed location update isn't worth surfacing to the rider
        });
      },
      () => {
        setError("Location access is off — turn it on so the customer can see you're on the way.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      📍 {error}
    </div>
  );
}
