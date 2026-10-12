"use server";

import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normaliseCode } from "@/lib/scan";

/** Admin: whether riders must scan the parcel label at pickup, and warehouse staff must scan or tick every item before an order is ready. */
export async function updateScanSettings(input: { requirePickupScan: boolean; requirePackScan: boolean }): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: tenantId } = await supabase.rpc("current_tenant_id" as never);
    if (!tenantId) throw new UserError("Could not work out which market these settings belong to.");
    const { error } = await supabase
      .from("company_settings")
      .update({ require_pickup_scan: !!input.requirePickupScan, require_pack_scan: !!input.requirePackScan } as never)
      .eq("tenant_id", tenantId as unknown as string);
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") throw new UserError("Scanning options need the latest database update (migration 0096). Run it, then try again.");
      throw error;
    }
    revalidatePath("/admin/settings");
  } catch (e) {
    return failure(e) as never;
  }
}

/** Admin: the order a scanned or typed order number belongs to (this market only; the database filters the rest). */
export async function findOrderByNumber(code: string): Promise<{ id: string; orderNumber: string } | null> {
  try {
    const wanted = normaliseCode(code);
    if (!wanted) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.from("orders").select("id, order_number").ilike("order_number", wanted).limit(1).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, orderNumber: data.order_number } : null;
  } catch (e) {
    return failure(e) as never;
  }
}
