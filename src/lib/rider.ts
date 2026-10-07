import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/delivery-geo";
import { getCompanySettings } from "@/lib/company-settings";
import type { DeliveryPartner, Profile } from "@/types/database";

export interface RiderProfile {
  profile: Profile;
  deliveryPartner: DeliveryPartner;
}

export async function getRiderProfile(): Promise<RiderProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: deliveryPartner }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("delivery_partners").select("*").eq("id", user.id).maybeSingle(),
  ]);

  if (!profile || !deliveryPartner) return null;
  return { profile, deliveryPartner };
}

/** For the /deliver apply page: the applicant's own delivery_partners row at
 * any status (pending/approved/rejected/suspended), unlike getRiderProfile()
 * above which only ever returns an approved one. */
export async function getMyRiderApplication(): Promise<DeliveryPartner | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("delivery_partners").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface AdminRiderRow extends DeliveryPartner {
  full_name: string | null;
  phone: string | null;
}

export async function getAllRiders(): Promise<AdminRiderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_partners")
    .select("*, profiles!inner(full_name, phone)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as (DeliveryPartner & { profiles: { full_name: string | null; phone: string | null } })[]).map(
    (row) => ({ ...row, full_name: row.profiles.full_name, phone: row.profiles.phone })
  );
}

export interface AvailableOrder {
  id: string;
  order_number: string;
  delivery_type: string;
  delivery_fee: number;
  created_at: string;
  warehouses: { name: string; address_line: string | null; lat: number | null; lng: number | null } | null;
  item_count: number;
  distanceKm: number | null;
}

// How far a rider is offered orders from, centred on their last live GPS
// ping (delivery_partners.current_lat/lng — streamed while online by
// RiderLocationTracker), not the warehouse's city. Independent of a
// warehouse's own customer delivery radius (delivery_radius_km) — that
// governs whether FasTrack will deliver TO a shopper; this governs how far
// a rider is asked to travel TO a pickup. Swiggy/Instamart-style: a rider
// standing in Jeddah should never be offered a Riyadh pickup just because
// it's the oldest order in the system.
export const RIDER_MATCH_RADIUS_KM = 20;

/** The market's own setting (Admin > Business settings), falling back to the default. */
export async function getRiderMatchRadiusKm(): Promise<number> {
  const value = Number((await getCompanySettings()).rider_pickup_radius_km);
  return Number.isFinite(value) && value > 0 ? value : RIDER_MATCH_RADIUS_KM;
}

export interface AvailableOrdersResult {
  orders: AvailableOrder[];
  hasLocation: boolean;
}

export async function getAvailableOrders(): Promise<AvailableOrdersResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from("delivery_partners").select("current_lat, current_lng").eq("id", user.id).maybeSingle()
    : { data: null };

  const myLat = me?.current_lat ?? null;
  const myLng = me?.current_lng ?? null;

  // No live location yet (rider just went online and the browser hasn't
  // reported a GPS fix) — show nothing rather than every order nationwide.
  // The UI prompts the rider to enable location instead.
  if (myLat == null || myLng == null) {
    return { orders: [], hasLocation: false };
  }

  const radiusKm = await getRiderMatchRadiusKm();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, delivery_type, delivery_fee, created_at, warehouses(name, address_line, lat, lng)")
    .in("status", ["preparing", "ready_for_pickup"]);

  if (error) throw error;
  if (!orders || orders.length === 0) return { orders: [], hasLocation: true };

  const { data: counts } = await supabase
    .from("order_items")
    .select("order_id")
    .in(
      "order_id",
      orders.map((o) => o.id)
    );

  const countByOrder = new Map<string, number>();
  for (const row of counts ?? []) {
    countByOrder.set(row.order_id, (countByOrder.get(row.order_id) ?? 0) + 1);
  }

  const withDistance = (orders as unknown as Omit<AvailableOrder, "item_count" | "distanceKm">[]).map((o) => ({
    ...o,
    item_count: countByOrder.get(o.id) ?? 0,
    distanceKm:
      o.warehouses?.lat != null && o.warehouses?.lng != null
        ? distanceKm(myLat, myLng, o.warehouses.lat, o.warehouses.lng)
        : null,
  }));

  const nearby = withDistance
    .filter((o) => o.distanceKm != null && o.distanceKm <= radiusKm)
    .sort((a, b) => (a.distanceKm as number) - (b.distanceKm as number));

  return { orders: nearby, hasLocation: true };
}

export interface ActiveDelivery {
  id: string;
  order_number: string;
  status: string;
  delivery_fee: number;
  total: number;
  delivery_otp: string | null;
  warehouses: { name: string; address_line: string | null; lat: number | null; lng: number | null } | null;
  addresses: { address_line: string; label: string; lat: number | null; lng: number | null } | null;
  item_count: number;
}

export async function getActiveDelivery(): Promise<ActiveDelivery | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("delivery_assignments")
    .select(
      "orders!inner(id, order_number, status, delivery_fee, total, delivery_otp, warehouses(name, address_line, lat, lng), addresses(address_line, label, lat, lng), order_items(id))"
    )
    .eq("rider_id", user.id)
    .not("orders.status", "in", "(delivered,cancelled)")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.orders) return null;
  const order = data.orders as unknown as ActiveDelivery & { order_items: { id: string }[] };
  return { ...order, item_count: order.order_items?.length ?? 0 };
}

export interface RiderTodayStats {
  deliveries: number;
  earnings: number;
}

export async function getRiderTodayStats(): Promise<RiderTodayStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { deliveries: 0, earnings: 0 };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("orders!inner(delivery_fee, status)")
    .eq("rider_id", user.id)
    .eq("orders.status", "delivered")
    .gte("delivered_at", startOfToday.toISOString());

  if (error) throw error;

  const rows = (data ?? []) as unknown as { orders: { delivery_fee: number } }[];
  return {
    deliveries: rows.length,
    earnings: rows.reduce((sum, r) => sum + Number(r.orders.delivery_fee), 0),
  };
}

export interface RiderLifetimeStats {
  totalDeliveries: number;
  totalEarnings: number;
  rating: number | null;
  memberSince: string;
}

export async function getRiderLifetimeStats(): Promise<RiderLifetimeStats | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: deliveries, error }, { data: rider }] = await Promise.all([
    supabase
      .from("delivery_assignments")
      .select("orders!inner(delivery_fee, status)")
      .eq("rider_id", user.id)
      .eq("orders.status", "delivered"),
    supabase.from("delivery_partners").select("rating, created_at").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (!rider) return null;

  const rows = (deliveries ?? []) as unknown as { orders: { delivery_fee: number } }[];
  return {
    totalDeliveries: rows.length,
    totalEarnings: rows.reduce((sum, r) => sum + Number(r.orders.delivery_fee), 0),
    rating: rider.rating,
    memberSince: rider.created_at,
  };
}

export interface DayEarnings {
  date: string;
  label: string;
  deliveries: number;
  earnings: number;
}

/** Last 7 days (oldest first, today last) — powers the earnings bar chart. */
export async function getWeeklyEarnings(): Promise<DayEarnings[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("delivered_at, orders!inner(delivery_fee, status)")
    .eq("rider_id", user.id)
    .eq("orders.status", "delivered")
    .gte("delivered_at", start.toISOString());
  if (error) throw error;

  const rows = (data ?? []) as unknown as { delivered_at: string; orders: { delivery_fee: number } }[];
  const byDay = new Map<string, { deliveries: number; earnings: number }>();
  for (const row of rows) {
    const key = row.delivered_at.slice(0, 10);
    const existing = byDay.get(key) ?? { deliveries: 0, earnings: 0 };
    existing.deliveries += 1;
    existing.earnings += Number(row.orders.delivery_fee);
    byDay.set(key, existing);
  }

  const days: DayEarnings[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(start.getDate() + (6 - i));
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { deliveries: 0, earnings: 0 };
    days.push({
      date: key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      ...entry,
    });
  }
  return days;
}
