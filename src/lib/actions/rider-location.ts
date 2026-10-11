"use server";

import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/delivery-geo";
import { getCompanySettings } from "@/lib/company-settings";
import { DEFAULT_ETA_SETTINGS } from "@/lib/eta";
import { notifyUsers } from "@/lib/push";
import { getCurrentTenant } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";

/** Roads are longer than the straight line; a stop at the shop to collect the order takes a few minutes. */
const ROAD_FACTOR = 1.3;
const PICKUP_MINUTES = 3;
/** Time to hand over an order at each stop after the first. */
const DROP_MINUTES = 2;

interface LiveOrderRow {
  id: string;
  status: string;
  order_number: string;
  live_eta_at?: string | null;
  live_eta_updated_at?: string | null;
  addresses: { lat: number | null; lng: number | null } | null;
  warehouses: { lat: number | null; lng: number | null } | null;
}

/**
 * Saves the rider's position, then re-works the arrival time of every order they are carrying from where they really are now
 * (rider -> shop -> customer before pickup, rider -> customer after). The new estimate is stored on the order, so the customer's
 * screen, the admin and notifications all show the same live figure. If it slips well past what was promised, the customer is told once.
 */
export async function updateRiderLocation(lat: number, lng: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("You must be logged in.");

    const { error } = await supabase.from("delivery_partners").update({ current_lat: lat, current_lng: lng }).eq("id", user.id);
    if (error) throw error;

    // The estimate is a bonus: it must never make saving the position fail.
    try {
      await refreshLiveEtas(user.id, lat, lng);
    } catch {
      // ignore: the next position update tries again
    }
  } catch (e) {
    return failure(e) as never;
  }
}

async function refreshLiveEtas(riderId: string, lat: number, lng: number) {
  const supabase = await createClient();
  // The live columns arrive with migration 0089/0090, so this is read loosely and skipped quietly until they are applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("delivery_assignments")
    .select("route_sequence, assigned_at, orders!inner(id, status, order_number, live_eta_at, live_eta_updated_at, addresses(lat, lng), warehouses(lat, lng))")
    .eq("rider_id", riderId)
    .is("delivered_at", null);
  if (error || !data) return;
  type Row = { route_sequence: number | null; assigned_at: string | null; orders: LiveOrderRow | LiveOrderRow[] | null };
  const carried = (data as Row[])
    .flatMap((r) => (Array.isArray(r.orders) ? r.orders : r.orders ? [r.orders] : []).map((o) => ({ o, seq: r.route_sequence, at: r.assigned_at ?? "" })))
    .filter(({ o }) => o.status === "rider_assigned" || o.status === "out_for_delivery");
  if (carried.length === 0) return;
  // Drops happen in the route's order; orders that are not on a route follow in the order they were assigned.
  carried.sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999) || a.at.localeCompare(b.at));

  const company = await getCompanySettings().catch(() => null);
  const speed = Number(company?.rider_speed_kmh ?? DEFAULT_ETA_SETTINGS.speedKmh) || DEFAULT_ETA_SETTINGS.speedKmh;
  const leg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR;
  const now = Date.now();
  const tz = timeZoneFor((await getCurrentTenant().catch(() => null))?.country_code);
  const pt = (p: { lat: number | null; lng: number | null } | null | undefined) => (p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null);

  // One journey through every stop: first collect what is still waiting at a shop, then drop off one by one.
  let pos = { lat, lng };
  let km = 0;
  let minutes = 0;
  const shopsVisited = new Set<string>();
  for (const { o } of carried) {
    const shop = pt(o.warehouses);
    if (o.status !== "rider_assigned" || !shop) continue;
    const key = `${shop.lat.toFixed(5)},${shop.lng.toFixed(5)}`;
    if (shopsVisited.has(key)) continue;
    shopsVisited.add(key);
    const d = leg(pos, shop);
    km += d;
    minutes += (d / speed) * 60 + PICKUP_MINUTES;
    pos = shop;
  }
  let stop = 0;
  for (const { o } of carried) {
    const dest = pt(o.addresses);
    if (!dest) continue;
    const d = leg(pos, dest);
    km += d;
    minutes += (d / speed) * 60 + (stop > 0 ? DROP_MINUTES : 0);
    pos = dest;
    stop++;
    const eta = new Date(now + Math.max(1, minutes) * 60_000);
    // Only save when it moved by a minute or more, or the saved one is getting old: keeps the number of writes small.
    const oldEta = o.live_eta_at ? new Date(o.live_eta_at).getTime() : 0;
    const age = o.live_eta_updated_at ? now - new Date(o.live_eta_updated_at).getTime() : Infinity;
    if (Math.abs(eta.getTime() - oldEta) < 60_000 && age < 90_000) continue;
    const { data: res } = await db.rpc("rider_update_live_eta", { p_order: o.id, p_eta: eta.toISOString(), p_km: km, p_stops: stop });
    const r = res as { late?: boolean; user_id?: string } | null;
    if (r?.late && r.user_id) {
      const at = eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
      await notifyUsers([r.user_id], { title: "Your order is running a little late", body: `Order #${o.order_number} should now arrive around ${at}. Sorry for the wait.`, url: `/orders/${o.id}` });
    }
  }
}
