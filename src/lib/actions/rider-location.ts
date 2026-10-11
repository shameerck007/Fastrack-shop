"use server";

import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/delivery-geo";
import { getCompanySettings } from "@/lib/company-settings";
import { DEFAULT_ETA_SETTINGS } from "@/lib/eta";
import { notifyUsers } from "@/lib/push";

/** Roads are longer than the straight line; a stop at the shop to collect the order takes a few minutes. */
const ROAD_FACTOR = 1.3;
const PICKUP_MINUTES = 3;

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
  // The live columns arrive with migration 0089, so this is read loosely and skipped quietly until it is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("delivery_assignments")
    .select("orders!inner(id, status, order_number, live_eta_at, live_eta_updated_at, addresses(lat, lng), warehouses(lat, lng))")
    .eq("rider_id", riderId)
    .is("delivered_at", null);
  if (error || !data) return;
  const orders = (data as { orders: LiveOrderRow | LiveOrderRow[] | null }[])
    .flatMap((r) => (Array.isArray(r.orders) ? r.orders : r.orders ? [r.orders] : []))
    .filter((o) => o.status === "rider_assigned" || o.status === "out_for_delivery");
  if (orders.length === 0) return;

  const company = await getCompanySettings().catch(() => null);
  const speed = Number(company?.rider_speed_kmh ?? DEFAULT_ETA_SETTINGS.speedKmh) || DEFAULT_ETA_SETTINGS.speedKmh;
  const leg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR;
  const now = Date.now();

  for (const o of orders) {
    const dest = o.addresses?.lat != null && o.addresses?.lng != null ? { lat: o.addresses.lat, lng: o.addresses.lng } : null;
    const shop = o.warehouses?.lat != null && o.warehouses?.lng != null ? { lat: o.warehouses.lat, lng: o.warehouses.lng } : null;
    if (!dest) continue;
    const here = { lat, lng };
    let km: number;
    let minutes: number;
    if (o.status === "rider_assigned" && shop) {
      km = leg(here, shop) + leg(shop, dest);
      minutes = (km / speed) * 60 + PICKUP_MINUTES;
    } else {
      km = leg(here, dest);
      minutes = (km / speed) * 60;
    }
    const eta = new Date(now + Math.max(1, minutes) * 60_000);
    // Only save when it moved by a minute or more, or the saved one is getting old: keeps the number of writes small.
    const oldEta = o.live_eta_at ? new Date(o.live_eta_at).getTime() : 0;
    const age = o.live_eta_updated_at ? now - new Date(o.live_eta_updated_at).getTime() : Infinity;
    if (Math.abs(eta.getTime() - oldEta) < 60_000 && age < 90_000) continue;
    const { data: res } = await db.rpc("rider_update_live_eta", { p_order: o.id, p_eta: eta.toISOString(), p_km: km });
    const r = res as { late?: boolean; user_id?: string } | null;
    if (r?.late && r.user_id) {
      const at = eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      await notifyUsers([r.user_id], { title: "Your order is running a little late", body: `Order #${o.order_number} should now arrive around ${at}. Sorry for the wait.`, url: `/orders/${o.id}` });
    }
  }
}
