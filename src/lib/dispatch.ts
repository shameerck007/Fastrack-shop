import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push";

/**
 * Quick (Express) delivery dispatch: asks the database for the nearest free rider inside the Express rider radius and
 * tells them. The database makes one offer at a time and handles expiry; this only triggers it and sends the push.
 * Safe to call any number of times for an order (a live offer, an assignment or a non-Express order all return null),
 * and a no-op until migration 0063 is applied.
 */
export async function dispatchExpressOrder(orderId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dispatch_express_order", { p_order_id: orderId });
    if (error || !data) return null;
    const riderId = data as unknown as string;
    const { data: order } = await supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle();
    await notifyUsers([riderId], {
      title: "New Express order",
      body: `Order #${order?.order_number ?? ""} is waiting. Accept it now.`,
      url: "/rider",
    });
    return riderId;
  } catch {
    return null;
  }
}
