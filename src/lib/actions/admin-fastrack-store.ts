"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "admins manage warehouses" RLS (0004) already lets an admin insert here —
// no new migration needed. A FasTrack-owned location is just a warehouses
// row nothing in `stores` points at (see getFastrackWarehouses).
export async function adminCreateFastrackWarehouse(input: { name: string; addressLine?: string }) {
  const supabase = await createClient();

  if (!input.name.trim()) throw new Error("A name is required.");

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ name: input.name.trim(), address_line: input.addressLine?.trim() || null })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/admin/store");
  revalidatePath("/admin/zones");
  return data.id as string;
}

export async function adminSetWarehouseActive(warehouseId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").update({ is_active: isActive }).eq("id", warehouseId);
  if (error) throw error;

  revalidatePath("/admin/store");
  revalidatePath("/admin/zones");
}
