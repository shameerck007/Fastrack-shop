"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

// The "merchants advance their orders to ready for pickup" RLS policy
// (0026/0027) is what actually enforces this: a plain update only ever
// succeeds when the order contains this merchant's own store item AND the
// transition is pending/confirmed/preparing -> the next stage. Any other
// order, or any other target status (rider_assigned, delivered, cancelled,
// ...), is silently rejected by Postgres — 0 rows affected — regardless of
// what this function is called with. The explicit `next` allowlist below is
// a UX guard (a clear error instead of a silent no-op), not the real
// security boundary.
const ALLOWED_NEXT: Record<string, OrderStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready_for_pickup",
};

export async function advanceMerchantOrderStatus(orderId: string, currentStatus: OrderStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const next = ALLOWED_NEXT[currentStatus];
  if (!next) throw new Error("This order can't be advanced from its current status.");

  const { data, error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("This order already moved on — refresh and try again.");
  }

  await supabase.from("order_status_history").insert({ order_id: orderId, status: next });

  revalidatePath("/merchant/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin/orders");
}
