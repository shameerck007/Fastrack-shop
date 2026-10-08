import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/delivery-geo";
import { getCompanySettings } from "@/lib/company-settings";
import { getRiderMatchRadiusKm } from "@/lib/rider";

// Standard delivery routes (migration 0066): the Standard orders ready at one shop for one area, taken by one rider as a batch.

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
type Loose = { rpc: (fn: string, args?: object) => RpcResult };

/** Put a ready Standard/scheduled order into its route (quietly does nothing before the migration, or for Express orders). */
export async function routeStandardOrder(orderId: string): Promise<boolean> {
  try {
    const supabase = (await createClient()) as unknown as Loose;
    const { data, error } = await supabase.rpc("route_standard_order", { p_order_id: orderId });
    return !error && !!data;
  } catch {
    return false;
  }
}

export interface AvailableRoute {
  id: string;
  areaLabel: string;
  shopName: string | null;
  shopAddress: string | null;
  stops: number;
  distanceKm: number | null;
  /** What the rider would earn for the whole route. */
  pay: number;
  /** The earliest promised date among the orders. */
  dueAt: string | null;
}

interface RouteRow {
  id: string;
  area_label: string;
  warehouses: { name: string; address_line: string | null; lat: number | null; lng: number | null; standard_delivery_days?: number | null } | null;
  delivery_route_orders: { order_id: string; orders: { created_at: string; scheduled_for: string | null; delivery_type: string; delivery_fee: number } | null }[];
}

/** Open routes within the rider's pickup distance, due soonest first. Empty until routes are on (migration 0066). */
export async function getAvailableRoutes(): Promise<AvailableRoute[]> {
  try {
    if ((await getCompanySettings()).standard_routes_enabled !== true) return [];
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: me } = await supabase.from("delivery_partners").select("current_lat, current_lng").eq("id", user.id).maybeSingle();
    if (me?.current_lat == null || me?.current_lng == null) return [];
    const loose = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: unknown; error: unknown }> } } };
    const { data, error } = await loose
      .from("delivery_routes")
      .select("id, area_label, warehouses(name, address_line, lat, lng, standard_delivery_days), delivery_route_orders(order_id, orders(created_at, scheduled_for, delivery_type, delivery_fee))")
      .eq("status", "open");
    if (error || !data) return [];
    const radius = await getRiderMatchRadiusKm();
    const rows = (data as unknown as RouteRow[]).filter((r) => r.delivery_route_orders.length > 0);

    const orderIds = rows.flatMap((r) => r.delivery_route_orders.map((o) => o.order_id));
    const payById = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: est } = await (supabase as unknown as Loose).rpc("rider_pay_estimates", { p_order_ids: orderIds });
      for (const e of (est as { est_order_id: string; est_pay: number | null }[] | null) ?? []) if (e.est_pay != null) payById.set(e.est_order_id, Number(e.est_pay));
    }

    return rows
      .map((r): AvailableRoute => {
        const w = r.warehouses;
        const d = w?.lat != null && w?.lng != null ? distanceKm(me.current_lat as number, me.current_lng as number, w.lat, w.lng) : null;
        const days = Number(w?.standard_delivery_days ?? 2);
        const dues = r.delivery_route_orders
          .map((o) => o.orders)
          .filter((o): o is NonNullable<typeof o> => !!o)
          .map((o) => (o.delivery_type === "scheduled" && o.scheduled_for ? new Date(o.scheduled_for).getTime() : new Date(o.created_at).getTime() + days * 86400000));
        return {
          id: r.id,
          areaLabel: r.area_label,
          shopName: w?.name ?? null,
          shopAddress: w?.address_line ?? null,
          stops: r.delivery_route_orders.length,
          distanceKm: d,
          pay: Math.round(r.delivery_route_orders.reduce((n, o) => n + (payById.get(o.order_id) ?? Number(o.orders?.delivery_fee ?? 0)), 0) * 100) / 100,
          dueAt: dues.length ? new Date(Math.min(...dues)).toISOString() : null,
        };
      })
      .filter((r) => r.distanceKm != null && r.distanceKm <= radius)
      .sort((a, b) => (a.dueAt && b.dueAt ? new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() : 0) || (a.distanceKm as number) - (b.distanceKm as number));
  } catch {
    return [];
  }
}

export interface RouteStop {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  cashToCollect: number;
  address: string | null;
  label: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  lat: number | null;
  lng: number | null;
  itemCount: number;
  pay: number;
}

export interface ActiveRoute {
  id: string;
  areaLabel: string;
  shopName: string | null;
  shopAddress: string | null;
  shopLat: number | null;
  shopLng: number | null;
  stops: RouteStop[];
  delivered: number;
  pickedUpAll: boolean;
}

/** Nearest-neighbour order of the stops starting from the shop: a simple, sensible drive order. Finished stops go last. */
export function orderStops(stops: RouteStop[], from: { lat: number | null; lng: number | null }): RouteStop[] {
  const open = stops.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
  const done = stops.filter((s) => s.status === "delivered" || s.status === "cancelled");
  const out: RouteStop[] = [];
  let cur = from.lat != null && from.lng != null ? { lat: from.lat, lng: from.lng } : null;
  const left = [...open];
  while (left.length) {
    let best = 0;
    if (cur) {
      let bd = Infinity;
      left.forEach((s, i) => {
        const d = s.lat != null && s.lng != null ? distanceKm(cur!.lat, cur!.lng, s.lat, s.lng) : Infinity;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
    }
    const [next] = left.splice(best, 1);
    out.push(next);
    if (next.lat != null && next.lng != null) cur = { lat: next.lat, lng: next.lng };
  }
  return [...out, ...done];
}

interface RouteRecord {
  id: string;
  area_label: string;
  warehouses: { name: string; address_line: string | null; lat: number | null; lng: number | null } | null;
  delivery_route_orders: { order_id: string }[];
}

/** The route this rider is working on now (assigned and not finished), or a specific one by id. */
export async function getRouteForRider(routeId?: string): Promise<ActiveRoute | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const loose = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> } };
          };
        };
      };
    };
    const { data, error } = await loose
      .from("delivery_routes")
      .select("id, area_label, status, warehouses(name, address_line, lat, lng), delivery_route_orders(order_id)")
      .eq("rider_id", user.id)
      .eq(routeId ? "id" : "status", routeId ?? "assigned")
      .order("assigned_at", { ascending: false })
      .limit(1);
    const route = (data as RouteRecord[] | null)?.[0];
    if (error || !route) return null;
    const ids = route.delivery_route_orders.map((o) => o.order_id);
    if (ids.length === 0) return null;
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, status, total, addresses(address_line, label, receiver_name, receiver_phone, lat, lng), payments(method, status), order_items(id)")
      .in("id", ids);
    const { data: pays } = await supabase.from("delivery_assignments").select("order_id, rider_pay").eq("rider_id", user.id).in("order_id", ids);
    const payById = new Map(((pays ?? []) as unknown as { order_id: string; rider_pay: number | null }[]).map((p) => [p.order_id, Number(p.rider_pay ?? 0)]));
    const stops: RouteStop[] = (
      (orders ?? []) as unknown as {
        id: string;
        order_number: string;
        status: string;
        total: number;
        addresses: { address_line: string; label: string; receiver_name: string | null; receiver_phone: string | null; lat: number | null; lng: number | null } | null;
        payments: { method: string; status: string }[] | null;
        order_items: { id: string }[];
      }[]
    ).map((o) => {
      const cod = o.payments?.[0]?.method === "cash_on_delivery" && o.payments?.[0]?.status !== "refunded";
      return {
        orderId: o.id,
        orderNumber: o.order_number,
        status: o.status,
        total: Number(o.total),
        cashToCollect: cod && o.status !== "delivered" ? Number(o.total) : 0,
        address: o.addresses?.address_line ?? null,
        label: o.addresses?.label ?? null,
        receiverName: o.addresses?.receiver_name ?? null,
        receiverPhone: o.addresses?.receiver_phone ?? null,
        lat: o.addresses?.lat ?? null,
        lng: o.addresses?.lng ?? null,
        itemCount: o.order_items?.length ?? 0,
        pay: payById.get(o.id) ?? 0,
      };
    });
    const live = stops.filter((s) => s.status !== "cancelled");
    return {
      id: route.id,
      areaLabel: route.area_label,
      shopName: route.warehouses?.name ?? null,
      shopAddress: route.warehouses?.address_line ?? null,
      shopLat: route.warehouses?.lat ?? null,
      shopLng: route.warehouses?.lng ?? null,
      stops: orderStops(stops, { lat: route.warehouses?.lat ?? null, lng: route.warehouses?.lng ?? null }),
      delivered: live.filter((s) => s.status === "delivered").length,
      pickedUpAll: live.length > 0 && live.every((s) => s.status === "out_for_delivery" || s.status === "delivered"),
    };
  } catch {
    return null;
  }
}
