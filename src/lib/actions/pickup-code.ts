"use server";

import { failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** The 4-digit pickup code for an order, for the store that fills it (warehouse staff, supplier) and admins. The database refuses everyone else. */
export async function getPickupCode(orderId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pickup_code_for" as never, { p_order: orderId } as never);
    if (error) throw error;
    return (data as unknown as string | null) ?? null;
  } catch (e) {
    return failure(e) as never;
  }
}
