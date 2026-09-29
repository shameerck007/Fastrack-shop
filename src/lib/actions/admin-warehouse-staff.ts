"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface FoundUser {
  id: string;
  fullName: string | null;
  role: string;
  hasStore: boolean;
}

/** Reuses admin_find_user_by_email (0024) as-is, same as findUserByEmail in admin-riders.ts. */
export async function findUserByEmailForWarehouse(email: string): Promise<FoundUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_find_user_by_email", { p_email: email.trim() });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { id: row.id, fullName: row.full_name, role: row.role, hasStore: row.has_store };
}

export interface WarehouseStaffRow {
  id: string;
  userId: string;
  fullName: string | null;
}

export async function getWarehouseStaffList(warehouseId: string): Promise<WarehouseStaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_staff")
    .select("id, user_id, profiles!user_id(full_name)")
    .eq("warehouse_id", warehouseId);
  if (error) throw error;

  type Row = { id: string; user_id: string; profiles: { full_name: string | null } | null };
  return ((data as unknown as Row[]) ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? null,
  }));
}

export async function adminAssignWarehouseStaff(warehouseId: string, userId: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("warehouse_staff").select("id").eq("user_id", userId).maybeSingle();
  if (existing) throw new Error("This user is already assigned to a warehouse.");

  const { error: insertError } = await supabase.from("warehouse_staff").insert({
    warehouse_id: warehouseId,
    user_id: userId,
  });
  if (insertError) throw insertError;

  const { error: profileError } = await supabase.from("profiles").update({ role: "store_staff" }).eq("id", userId);
  if (profileError) throw profileError;

  revalidatePath(`/admin/store/${warehouseId}`);
}

export async function adminRemoveWarehouseStaff(staffId: string, userId: string, warehouseId: string) {
  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("warehouse_staff").delete().eq("id", staffId);
  if (deleteError) throw deleteError;

  const { error: profileError } = await supabase.from("profiles").update({ role: "customer" }).eq("id", userId);
  if (profileError) throw profileError;

  revalidatePath(`/admin/store/${warehouseId}`);
}
