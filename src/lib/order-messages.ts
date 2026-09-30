import { createClient } from "@/lib/supabase/server";
import type { OrderMessage } from "@/types/database";

export async function getOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
