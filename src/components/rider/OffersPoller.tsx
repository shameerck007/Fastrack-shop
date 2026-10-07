"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a rider is online and free, re-check for new orders and offers every few seconds so an offer shows up
// without a manual refresh (the push notification is the backup when the app is in the background).
export default function OffersPoller({ everySeconds = 6 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everySeconds * 1000);
    return () => clearInterval(id);
  }, [router, everySeconds]);
  return null;
}
