"use client";

import { createContext, useContext } from "react";
import type { EtaRange } from "@/lib/eta";

export interface DeliveryLocation {
  lat: number;
  lng: number;
  label: string;
  addressId?: string;
  /** Set when the position came from the device GPS (vs a saved address or searched place). */
  source?: "gps";
}

export interface ZoneRow {
  storeId: string | null; // null = FasTrack's own products
  lat: number | null;
  lng: number | null;
  /** Express radius (the former "delivery radius"). */
  radiusKm: number | null;
  standardEnabled: boolean;
  standardRadiusKm: number | null;
  standardDays: number;
  /** Custom Express area drawn on the map; replaces the circle for Express when set. */
  polygon?: [number, number][] | null;
}

export type DeliveryStatus =
  | { state: "loading" }
  | { state: "no_location" }
  | {
      state: "ok";
      /** Express delivery is offered here (inside the express radius). */
      express: boolean;
      /** Standard delivery is offered here. */
      standard: boolean;
      standardDays: number;
      expressRadiusKm: number | null;
    }
  /** Neither Express nor Standard reaches this location. */
  | { state: "outside"; distanceKm: number; radiusKm: number };

export interface Ctx {
  location: DeliveryLocation | null;
  ready: boolean;
  /** null while unknown (zones not loaded / no location yet). */
  serviceable: boolean | null;
  statusForStore: (storeId: string | null) => DeliveryStatus;
  /** Does any seller reach these coordinates? null while zones are still loading. */
  serviceableAt: (lat: number, lng: number) => boolean | null;
  setLocation: (loc: DeliveryLocation) => void;
  openPicker: () => void;
  /** Express delivery time for this seller at the shopper's location (null when Express does not reach them). */
  etaForStore: (storeId: string | null) => EtaRange | null;
  /** The fastest Express time among all sellers at the shopper's location. */
  bestEta: () => EtaRange | null;
  /** Express time at these coordinates for a set of sellers (the slowest one decides). */
  etaAt: (lat: number, lng: number, storeIds: (string | null)[]) => EtaRange | null;
}

export const DeliveryCtx = createContext<Ctx | null>(null);

export function useDeliveryLocation(): Ctx {
  const ctx = useContext(DeliveryCtx);
  if (!ctx) throw new Error("useDeliveryLocation must be used inside DeliveryLocationProvider");
  return ctx;
}

