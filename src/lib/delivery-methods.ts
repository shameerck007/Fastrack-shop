// Express vs Standard delivery, from a delivery boundary and the customer's location.
// Pure functions shared by the server and the browser.
//
//   A shop with no delivery area set yet is not live: nothing is offered until an admin sets one.
//   Express  - only inside the warehouse's express radius (the old "delivery radius").
//   Standard - on by default with no distance limit; a radius can restrict it, or it
//              can be switched off entirely.
//
// A product is available when at least one of the two applies.

import { distanceKm, type Coords } from "@/lib/delivery-geo";
import { DEFAULT_OFFSET_MINUTES } from "@/lib/timezone";
import { pointInPolygon, type LatLng } from "@/lib/geo-polygon";

export interface DeliveryZone {
  lat: number | null;
  lng: number | null;
  /** Express radius; null = Express isn't limited by distance. */
  expressRadiusKm: number | null;
  /** A custom Express area drawn on the map. When set it replaces the circle for Express. */
  polygon?: LatLng[] | null;
  standardEnabled: boolean;
  /** Standard radius; null = no distance limit. */
  standardRadiusKm: number | null;
  /** Estimated days for Standard delivery. */
  standardDays: number;
}

export const DEFAULT_STANDARD_DAYS = 2;

export type DeliveryMethods =
  | { state: "no_location" }
  | {
      state: "known";
      express: boolean;
      standard: boolean;
      standardDays: number;
      /** Distance to the warehouse, when both points are known. */
      distanceKm: number | null;
      expressRadiusKm: number | null;
      standardRadiusKm: number | null;
    };

/** Which delivery methods this zone offers at these coordinates. */
export function methodsFor(zone: DeliveryZone | undefined, coords: Coords | null): DeliveryMethods {
  // No boundary information at all: unrestricted, both methods.
  if (!zone) {
    return { state: "known", express: true, standard: true, standardDays: DEFAULT_STANDARD_DAYS, distanceKm: null, expressRadiusKm: null, standardRadiusKm: null };
  }

  // A shop goes live only once an admin has set its delivery area (an Express radius or a drawn area): until then nothing is offered.
  if (zone.expressRadiusKm == null && !(zone.polygon && zone.polygon.length >= 3)) {
    return { state: "known", express: false, standard: false, standardDays: zone.standardDays, distanceKm: null, expressRadiusKm: null, standardRadiusKm: zone.standardRadiusKm };
  }

  const haveZonePoint = zone.lat != null && zone.lng != null;
  const haveCustomer = !!coords && coords.lat != null && coords.lng != null;
  const distance = haveZonePoint && haveCustomer ? distanceKm(zone.lat as number, zone.lng as number, coords!.lat as number, coords!.lng as number) : null;

  const hasPolygon = !!zone.polygon && zone.polygon.length >= 3;
  // A distance limit can't be evaluated without the customer's location.
  const needsDistance = hasPolygon || zone.expressRadiusKm != null || (zone.standardEnabled && zone.standardRadiusKm != null);
  if (needsDistance && haveZonePoint && !haveCustomer) {
    // Standard with no distance limit doesn't need the location to be shown and ordered; Express can't be confirmed without it.
    const standardOpen = zone.standardEnabled && zone.standardRadiusKm == null;
    if (!standardOpen) return { state: "no_location" };
    return {
      state: "known",
      express: !hasPolygon && zone.expressRadiusKm == null,
      standard: true,
      standardDays: zone.standardDays,
      distanceKm: null,
      expressRadiusKm: zone.expressRadiusKm,
      standardRadiusKm: zone.standardRadiusKm,
    };
  }

  const express = hasPolygon
    ? haveCustomer && pointInPolygon(coords!.lat as number, coords!.lng as number, zone.polygon as LatLng[])
    : zone.expressRadiusKm == null || !haveZonePoint || (distance !== null && distance <= zone.expressRadiusKm);
  const standard =
    zone.standardEnabled && (zone.standardRadiusKm == null || !haveZonePoint || (distance !== null && distance <= zone.standardRadiusKm));

  return {
    state: "known",
    express,
    standard,
    standardDays: zone.standardDays,
    distanceKm: distance,
    expressRadiusKm: zone.expressRadiusKm,
    standardRadiusKm: zone.standardRadiusKm,
  };
}

/** Combine several items' methods: a method is offered only if every item supports it; Standard takes the slowest item. */
export function combineMethods(list: DeliveryMethods[]): { express: boolean; standard: boolean; standardDays: number } {
  const known = list.filter((m): m is Extract<DeliveryMethods, { state: "known" }> => m.state === "known");
  if (known.length === 0) return { express: false, standard: false, standardDays: DEFAULT_STANDARD_DAYS };
  return {
    express: known.every((m) => m.express),
    standard: known.every((m) => m.standard),
    standardDays: Math.max(...known.map((m) => m.standardDays)),
  };
}

/** Estimated Standard delivery date: today plus the warehouse's days (counted on the market's clock). */
export function standardDeliveryDate(days: number, now = new Date(), offsetMinutes: number = DEFAULT_OFFSET_MINUTES): Date {
  const riyadh = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  riyadh.setUTCDate(riyadh.getUTCDate() + Math.max(0, days));
  return new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate(), 12));
}

export function formatDeliveryDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** Delivery fees per market, in that market's own currency. Free delivery applies from `freeOver`. */
export interface DeliveryPricing {
  express: number;
  standard: number;
  freeOver: number;
}

const PRICING: Record<string, DeliveryPricing> = {
  SA: { express: 12, standard: 7, freeOver: 50 },
  // India: roughly the same money in rupees, rounded to typical local quick-commerce levels.
  IN: { express: 49, standard: 29, freeOver: 499 },
};

export function pricingFor(countryCode: string | null | undefined): DeliveryPricing {
  return PRICING[(countryCode ?? "SA").toUpperCase()] ?? PRICING.SA;
}

export function deliveryFee(method: "express" | "standard" | "scheduled", subtotal: number, pricing: DeliveryPricing): number {
  if (subtotal >= pricing.freeOver) return 0;
  return method === "express" ? pricing.express : pricing.standard;
}
