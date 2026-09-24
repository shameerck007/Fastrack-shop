"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveStore(storeId: string) {
  const supabase = await createClient();

  const { data: store, error: fetchError } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!store) throw new Error("Store not found.");

  // Give the merchant their own warehouse row so the existing
  // inventory/rider-pickup pipeline (built for FasTrack's own dark store)
  // works unchanged for their products too.
  const { data: warehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .insert({
      name: `${store.name} (Merchant)`,
      address_line: store.address_line,
    })
    .select("id")
    .single();
  if (warehouseError) throw warehouseError;

  const { error: storeError } = await supabase
    .from("stores")
    .update({ status: "approved", warehouse_id: warehouse.id, rejection_reason: null })
    .eq("id", storeId);
  if (storeError) throw storeError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "merchant" })
    .eq("id", store.owner_id);
  if (profileError) throw profileError;

  revalidatePath("/admin/merchants");
}

export async function rejectStore(storeId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status: "rejected", rejection_reason: reason || "Application did not meet requirements." })
    .eq("id", storeId);
  if (error) throw error;

  revalidatePath("/admin/merchants");
}
