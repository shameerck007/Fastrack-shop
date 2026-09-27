"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Shared by approving a pending application and an admin adding a merchant
// directly: gives the store its own warehouse so the existing
// inventory/rider-pickup pipeline (built for FasTrack's own dark store)
// works unchanged for their products too, marks the store approved, and
// promotes the owner's profile to merchant.
async function finalizeApproval(
  supabase: SupabaseServerClient,
  store: { id: string; name: string; address_line: string | null; owner_id: string }
) {
  const { data: warehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .insert({ name: `${store.name} (Merchant)`, address_line: store.address_line })
    .select("id")
    .single();
  if (warehouseError) throw warehouseError;

  const { error: storeError } = await supabase
    .from("stores")
    .update({ status: "approved", warehouse_id: warehouse.id, rejection_reason: null })
    .eq("id", store.id);
  if (storeError) throw storeError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "merchant" })
    .eq("id", store.owner_id);
  if (profileError) throw profileError;
}

export async function approveStore(storeId: string) {
  const supabase = await createClient();

  const { data: store, error: fetchError } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!store) throw new Error("Store not found.");

  await finalizeApproval(supabase, store);
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

export async function suspendStore(storeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update({ status: "suspended" }).eq("id", storeId);
  if (error) throw error;
  revalidatePath("/admin/merchants");
}

export async function reinstateStore(storeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update({ status: "approved" }).eq("id", storeId);
  if (error) throw error;
  revalidatePath("/admin/merchants");
}

export interface FoundUser {
  id: string;
  fullName: string | null;
  role: string;
  hasStore: boolean;
}

/** Looks up an existing registered user by email — the admin picks who owns the store being added manually. */
export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_find_user_by_email", { p_email: email.trim() });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { id: row.id, fullName: row.full_name, role: row.role, hasStore: row.has_store };
}

export interface AdminCreateMerchantInput {
  ownerId: string;
  name: string;
  crNumber: string;
  vatNumber?: string;
  contactPhone?: string;
  addressLine?: string;
  city: string;
  country: string;
}

/** Admin adding a merchant directly: skips the applicant flow and is approved immediately. */
export async function adminCreateMerchant(input: AdminCreateMerchantInput) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (existing) throw new Error("This user already has a store.");

  const { data: store, error: insertError } = await supabase
    .from("stores")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      cr_number: input.crNumber,
      vat_number: input.vatNumber || null,
      contact_phone: input.contactPhone || null,
      address_line: input.addressLine || null,
      city: input.city || "Riyadh",
      country: input.country || "Saudi Arabia",
      status: "pending",
    })
    .select("id, name, address_line, owner_id")
    .single();
  if (insertError) throw insertError;

  await finalizeApproval(supabase, store);
  revalidatePath("/admin/merchants");
  return store.id as string;
}
