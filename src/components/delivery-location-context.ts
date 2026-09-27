"use client";

import { createContext, useContext } from "react";

export interface DeliveryLocation {
  lat: number;
  lng: number;
  label: string;
  addressId?: string;
}

export interface ZoneRow {
  storeId: string | null; // null = FasTrack's own products
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
}

export type DeliveryStatus =
  | { state: "loading" }
  | { state: "no_location" }
  | { state: "ok" }
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
}

export const DeliveryCtx = createContext<Ctx | null>(null);

export function useDeliveryLocation(): Ctx {
  const ctx = useContext(DeliveryCtx);
  if (!ctx) throw new Error("useDeliveryLocation must be used inside DeliveryLocationProvider");
  return ctx;
}

