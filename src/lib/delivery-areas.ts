// Common delivery areas (migration 0074). Pure functions shared by the server and the browser.
//
// The admin draws a few shared areas; a shop only has its GPS pin. For a shop and a customer the rules are:
//   - the customer must be inside some area, or nothing is offered;
//   - Express: the customer's area and the shop's area both allow Express, the shop has not switched it off, and the distance is
//     within the smallest "Express up to" limit of the two areas and the shop's own limit;
//   - Standard: the customer's area allows it, and so does the shop's area. A shop outside every area can still use Standard.
// While no area exists the old per-shop boundaries are used instead.

import { distanceKm } from "@/lib/delivery-geo";
import { parsePolygon, pointInPolygon, type LatLng } from "@/lib/geo-polygon";

export interface DeliveryArea {
  id: string;
  name: string;
  nameAr?: string | null;
  polygon: LatLng[] | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  expressEnabled: boolean;
  expressMaxKm: number;
  standardEnabled: boolean;
  standardDays: number;
  logisticsEnabled: boolean;
  priority: number;
}

interface AreaRow {
  id: string;
  name: string;
  name_ar?: string | null;
  polygon?: unknown;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | string | null;
  express_enabled?: boolean;
  express_max_km?: number | string | null;
  standard_enabled?: boolean;
  standard_days?: number | null;
  logistics_enabled?: boolean;
  priority?: number | null;
}

/** Reads rows from public_delivery_areas() (or the table) into clean areas. */
export function parseAreas(rows: unknown): DeliveryArea[] {
  if (!Array.isArray(rows)) return [];
  return (rows as AreaRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    nameAr: r.name_ar ?? null,
    polygon: parsePolygon(r.polygon),
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    radiusKm: r.radius_km == null ? null : Number(r.radius_km),
    expressEnabled: r.express_enabled ?? true,
    expressMaxKm: r.express_max_km == null ? 8 : Number(r.express_max_km),
    standardEnabled: r.standard_enabled ?? true,
    standardDays: r.standard_days ?? 2,
    logisticsEnabled: r.logistics_enabled ?? false,
    priority: r.priority ?? 0,
  }));
}

function contains(area: DeliveryArea, lat: number, lng: number): boolean {
  if (area.polygon && area.polygon.length >= 3) return pointInPolygon(lat, lng, area.polygon);
  if (area.lat == null || area.lng == null || area.radiusKm == null) return false;
  return distanceKm(area.lat, area.lng, lat, lng) <= area.radiusKm;
}

/** The area a point sits in. Where areas overlap the higher priority wins, then the smaller circle / first drawn. */
export function areaAt(areas: DeliveryArea[], lat: number | null | undefined, lng: number | null | undefined): DeliveryArea | null {
  if (lat == null || lng == null) return null;
  let best: DeliveryArea | null = null;
  for (const a of areas) {
    if (!contains(a, lat, lng)) continue;
    if (!best || a.priority > best.priority || (a.priority === best.priority && (a.radiusKm ?? Infinity) < (best.radiusKm ?? Infinity))) best = a;
  }
  return best;
}

export interface AreaShop {
  lat: number | null;
  lng: number | null;
  /** "off" switches Express off for this shop only. */
  expressMode?: "auto" | "off" | null;
  /** This shop's own, shorter Express distance limit. */
  expressMaxKm?: number | null;
}

export interface AreaVerdict {
  /** False when the customer (or the shop's own pin) is not covered at all. */
  covered: boolean;
  express: boolean;
  standard: boolean;
  standardDays: number;
  distanceKm: number | null;
  /** The Express distance limit that applied (km). */
  expressLimitKm: number | null;
  customerArea: DeliveryArea | null;
  shopArea: DeliveryArea | null;
}

/** What one shop can offer to one customer location under the areas. */
export function verdictInAreas(areas: DeliveryArea[], shop: AreaShop, customer: { lat: number; lng: number }): AreaVerdict {
  const customerArea = areaAt(areas, customer.lat, customer.lng);
  const shopArea = areaAt(areas, shop.lat, shop.lng);
  const distance = shop.lat != null && shop.lng != null ? distanceKm(shop.lat, shop.lng, customer.lat, customer.lng) : null;
  if (!customerArea || shop.lat == null || shop.lng == null) {
    return { covered: false, express: false, standard: false, standardDays: 2, distanceKm: distance, expressLimitKm: null, customerArea, shopArea };
  }
  const limits = [customerArea.expressMaxKm, shopArea?.expressMaxKm, shop.expressMaxKm].filter((n): n is number => typeof n === "number" && n > 0);
  const limit = Math.min(...limits);
  const express =
    shop.expressMode !== "off" && customerArea.expressEnabled && !!shopArea && shopArea.expressEnabled && distance !== null && distance <= limit;
  const standard = customerArea.standardEnabled && (shopArea ? shopArea.standardEnabled : true);
  return {
    covered: true,
    express,
    standard,
    standardDays: Math.max(customerArea.standardDays, shopArea?.standardDays ?? 0),
    distanceKm: distance,
    expressLimitKm: limit,
    customerArea,
    shopArea,
  };
}
