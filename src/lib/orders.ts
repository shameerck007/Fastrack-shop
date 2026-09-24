import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusHistory } from "@/types/database";

export interface OrderDetail extends Order {
  order_items: OrderItem[];
  order_status_history: OrderStatusHistory[];
  addresses: { address_line: string; label: string } | null;
  delivery_assignments: {
    id: string;
    rider_id: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), order_status_history(*), addresses(address_line, label), delivery_assignments(id, rider_id, profiles(full_name, phone))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as OrderDetail | null;
}
