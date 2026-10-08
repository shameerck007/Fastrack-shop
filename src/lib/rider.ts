import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/delivery-geo";
import { getCompanySettings } from "@/lib/company-settings";
import type { DeliveryPartner, Profile } from "@/types/database";


/** "rider_pay, " when migration 0064 is applied, "" before it, so the rider screens keep working until it is. */
const riderPayCols = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_assignments").select("rider_pay").limit(1);
  return error ? "" : "rider_pay, ";
});

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
  warehouses: { name: string; address_line: string | null; lat: number | null; lng: number | null; standard_delivery_days?: number | null } | null;
  item_count: number;
  distanceKm: number | null;
  /** What the rider would earn for this order (their pay setting, else the delivery fee). */
  riderPay: number;
  /** When the customer was promised delivery by (Standard: order time plus the shop's days; Scheduled: the chosen slot). Null for Express. */
  dueAt: string | null;
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
  // With automatic quick-delivery dispatch on, Express orders reach a rider as an offer, not through this open list.
  const autoExpress = (await getCompanySettings()).express_auto_dispatch === true;
  const columns = "id, order_number, delivery_type, delivery_fee, created_at, scheduled_for, warehouses(name, address_line, lat, lng, standard_delivery_days)";
  const first = await supabase.from("orders").select(columns).in("status", ["preparing", "ready_for_pickup"]);
  let orders: unknown[] | null = first.data;
  let error = first.error;
  // Older databases may lack the Standard-days column; fall back to the default promise.
  if (error && (error.code === "42703" || error.code === "PGRST200" || error.code === "PGRST204")) {
    const retry = await supabase
      .from("orders")
      .select("id, order_number, delivery_type, delivery_fee, created_at, scheduled_for, warehouses(name, address_line, lat, lng)")
      .in("status", ["preparing", "ready_for_pickup"]);
    orders = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  if (!orders || orders.length === 0) return { orders: [], hasLocation: true };

  const { data: counts } = await supabase
    .from("order_items")
    .select("order_id")
    .in(
      "order_id",
      (orders as { id: string }[]).map((o) => o.id)
    );

  const countByOrder = new Map<string, number>();
  for (const row of counts ?? []) {
    countByOrder.set(row.order_id, (countByOrder.get(row.order_id) ?? 0) + 1);
  }

  const withDistance = (orders as unknown as (Omit<AvailableOrder, "item_count" | "distanceKm" | "dueAt"> & { scheduled_for: string | null })[]).map((o) => ({
    ...o,
    item_count: countByOrder.get(o.id) ?? 0,
    dueAt:
      o.delivery_type === "express"
        ? null
        : o.delivery_type === "scheduled" && o.scheduled_for
          ? o.scheduled_for
          : new Date(new Date(o.created_at).getTime() + (o.warehouses?.standard_delivery_days ?? 2) * 86400000).toISOString(),
    distanceKm:
      o.warehouses?.lat != null && o.warehouses?.lng != null
        ? distanceKm(myLat, myLng, o.warehouses.lat, o.warehouses.lng)
        : null,
  }));

  // Order of the list: anything already overdue first, then Express (nearest first), then Standard/Scheduled by promised date.
  const now = Date.now();
  const rank = (o: { dueAt: string | null }) => (o.dueAt && new Date(o.dueAt).getTime() < now ? 0 : o.dueAt == null ? 1 : 2);
  const nearby = withDistance
    .filter((o) => !(autoExpress && o.delivery_type === "express"))
    .filter((o) => o.distanceKm != null && o.distanceKm <= radiusKm)
    .sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      return (a.distanceKm as number) - (b.distanceKm as number);
    });

  // What the rider would earn for each order (the market's rider-pay setting; falls back to the delivery fee).
  const payById = new Map<string, number>();
  if (nearby.length > 0) {
    const { data: est } = await (supabase as unknown as { rpc: (fn: string, a: object) => Promise<{ data: { est_order_id: string; est_pay: number | null }[] | null }> }).rpc(
      "rider_pay_estimates",
      { p_order_ids: nearby.map((o) => o.id) }
    );
    for (const r of est ?? []) if (r.est_pay != null) payById.set(r.est_order_id, Number(r.est_pay));
  }
  return { orders: nearby.map((o) => ({ ...o, riderPay: payById.get(o.id) ?? Number(o.delivery_fee) })), hasLocation: true };
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
      (await riderPayCols()) + "orders!inner(id, order_number, status, delivery_fee, total, delivery_otp, warehouses(name, address_line, lat, lng), addresses(address_line, label, lat, lng), order_items(id))"
    )
    .eq("rider_id", user.id)
    .not("orders.status", "in", "(delivered,cancelled)")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.orders) return null;
  const order = data.orders as unknown as ActiveDelivery & { order_items: { id: string }[] };
  const pay = (data as unknown as { rider_pay: number | null }).rider_pay;
  return { ...order, delivery_fee: Number(pay ?? order.delivery_fee), item_count: order.order_items?.length ?? 0 };
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
    .select((await riderPayCols()) + "orders!inner(delivery_fee, status)")
    .eq("rider_id", user.id)
    .eq("orders.status", "delivered")
    .gte("delivered_at", startOfToday.toISOString());

  if (error) throw error;

  const rows = (data ?? []) as unknown as { rider_pay: number | null; orders: { delivery_fee: number } }[];
  return {
    deliveries: rows.length,
    earnings: rows.reduce((sum, r) => sum + Number(r.rider_pay ?? r.orders.delivery_fee), 0),
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

  const payCols = await riderPayCols();
  const [{ data: deliveries, error }, { data: rider }] = await Promise.all([
    supabase
      .from("delivery_assignments")
      .select(payCols + "orders!inner(delivery_fee, status)")
      .eq("rider_id", user.id)
      .eq("orders.status", "delivered"),
    supabase.from("delivery_partners").select("rating, created_at").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (!rider) return null;

  const rows = (deliveries ?? []) as unknown as { rider_pay: number | null; orders: { delivery_fee: number } }[];
  return {
    totalDeliveries: rows.length,
    totalEarnings: rows.reduce((sum, r) => sum + Number(r.rider_pay ?? r.orders.delivery_fee), 0),
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
    .select("delivered_at, " + (await riderPayCols()) + "orders!inner(delivery_fee, status)")
    .eq("rider_id", user.id)
    .eq("orders.status", "delivered")
    .gte("delivered_at", start.toISOString());
  if (error) throw error;

  const rows = (data ?? []) as unknown as { delivered_at: string; rider_pay: number | null; orders: { delivery_fee: number } }[];
  const byDay = new Map<string, { deliveries: number; earnings: number }>();
  for (const row of rows) {
    const key = row.delivered_at.slice(0, 10);
    const existing = byDay.get(key) ?? { deliveries: 0, earnings: 0 };
    existing.deliveries += 1;
    existing.earnings += Number(row.rider_pay ?? row.orders.delivery_fee);
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

export interface LiveOffer {
  id: string;
  orderId: string;
  orderNumber: string;
  expiresAt: string;
  secondsLeft: number;
  distanceKm: number | null;
  deliveryFee: number;
  itemCount: number;
  shopName: string | null;
  shopAddress: string | null;
}

/** The Express offer waiting for this rider right now, if any (none until migration 0063 is applied). */
export async function getMyLiveOffer(): Promise<LiveOffer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("delivery_offers" as never)
    .select("id, order_id, expires_at, distance_km, " + ((await riderPayCols()) ? "rider_pay, " : "") + "orders(order_number, delivery_fee, warehouses(name, address_line), order_items(id))")
    .eq("rider_id", user.id)
    .eq("status", "offered")
    .gt("expires_at", new Date().toISOString())
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    id: string;
    order_id: string;
    expires_at: string;
    distance_km: number | null;
    rider_pay: number | null;
    orders: { order_number: string; delivery_fee: number; warehouses: { name: string; address_line: string | null } | null; order_items: { id: string }[] } | null;
  };
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.orders?.order_number ?? "",
    expiresAt: row.expires_at,
    secondsLeft: Math.max(0, Math.round((new Date(row.expires_at).getTime() - Date.now()) / 1000)),
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    deliveryFee: Number(row.rider_pay ?? row.orders?.delivery_fee ?? 0),
    itemCount: row.orders?.order_items?.length ?? 0,
    shopName: row.orders?.warehouses?.name ?? null,
    shopAddress: row.orders?.warehouses?.address_line ?? null,
  };
}
