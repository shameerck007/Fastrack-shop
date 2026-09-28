import { createClient } from "@/lib/supabase/server";
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
  warehouses: { name: string; address_line: string | null } | null;
  item_count: number;
}

export async function getAvailableOrders(): Promise<AvailableOrder[]> {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, delivery_type, delivery_fee, created_at, warehouses(name, address_line)")
    .in("status", ["preparing", "ready_for_pickup"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!orders || orders.length === 0) return [];

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

  return (orders as unknown as Omit<AvailableOrder, "item_count">[]).map((o) => ({
    ...o,
    item_count: countByOrder.get(o.id) ?? 0,
  }));
}

export interface ActiveDelivery {
  id: string;
  order_number: string;
  status: string;
  delivery_fee: number;
  total: number;
  delivery_otp: string | null;
  warehouses: { name: string; address_line: string | null } | null;
  addresses: { address_line: string; label: string } | null;
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
      "orders!inner(id, order_number, status, delivery_fee, total, delivery_otp, warehouses(name, address_line), addresses(address_line, label))"
    )
    .eq("rider_id", user.id)
    .not("orders.status", "in", "(delivered,cancelled)")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.orders as unknown as ActiveDelivery) ?? null;
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
