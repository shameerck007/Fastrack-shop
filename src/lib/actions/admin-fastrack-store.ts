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

  // A brand-new FasTrack location otherwise starts with zero inventory rows
  // for the shared catalog — not just an empty-looking staff stock page,
  // but a real checkout failure: decrement_stock() raises "insufficient
  // stock" for any item with no row at all, not only a genuinely out-of-
  // stock one. Seed one row per shared-catalog variant at 0 stock so the
  // location exists in the system as "everything out of stock until staff
  // set real numbers" (the honest starting state) rather than "nothing
  // exists here at all".
  const { data: variantRows } = await supabase
    .from("product_variants")
    .select("id, products!inner(store_id)");
  const ownVariantIds = ((variantRows ?? []) as unknown as { id: string; products: { store_id: string | null } }[])
    .filter((v) => v.products.store_id === null)
    .map((v) => v.id);
  if (ownVariantIds.length > 0) {
    await supabase
      .from("inventory")
      .insert(ownVariantIds.map((variantId) => ({ variant_id: variantId, warehouse_id: data.id, stock: 0 })));
  }

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
