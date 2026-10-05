"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getOpenStatus, type OpenStatus, type OpeningHours } from "@/lib/store-hours";

export interface StoreInfo {
  id: string;
  name: string;
  city: string;
  logo_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  opening_hours: OpeningHours;
  accepting_orders: boolean;
}

interface Ctx {
  stores: Map<string, StoreInfo>;
  /** Bumped every 30s so open/closed labels roll over without a reload. */
  tick: number;
}

const StoreDirectoryCtx = createContext<Ctx>({ stores: new Map(), tick: 0 });

export default function StoreDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Map<string, StoreInfo>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stores")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: StoreInfo[]) => {
        if (!cancelled) setStores(new Map(rows.map((s) => [s.id, s])));
      })
      .catch(() => {});
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const value = useMemo(() => ({ stores, tick }), [stores, tick]);
  return <StoreDirectoryCtx.Provider value={value}>{children}</StoreDirectoryCtx.Provider>;
}

/** The supplier behind a product (null for FasTrack's own stock or while the
 * directory is still loading) and whether it can take orders right now. */
export function useStoreInfo(storeId: string | null | undefined): { store: StoreInfo | null; status: OpenStatus | null } {
  const { stores, tick } = useContext(StoreDirectoryCtx);
  const store = storeId ? (stores.get(storeId) ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const status = useMemo(() => (store ? getOpenStatus(store.opening_hours, store.accepting_orders) : null), [store, tick]);
  return { store, status };
}
