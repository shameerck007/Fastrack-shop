"use server";

import { checkCrNumber, checkVatNumber } from "@/lib/saudi-tax";
import { getCurrentTenant } from "@/lib/tenant-server";
import { checkFssai, checkGstin, checkIndianBankDetails, checkPan, validateIndiaSupplier, type IndiaSupplierValue } from "@/lib/india-business";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push";
import { sendApplicationDecisionEmail } from "@/lib/email-notifications";
import { sanitizeOpeningHours } from "@/lib/store-hours";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Shared by approving a pending application and an admin adding a merchant
// directly: gives the store its own warehouse so the existing
// inventory/rider-pickup pipeline (built for FasTrack's own dark store)
// works unchanged for their products too, marks the store approved, and
// promotes the owner's profile to merchant.
async function finalizeApproval(
  supabase: SupabaseServerClient,
  store: { id: string; name: string; address_line: string | null; owner_id: string; lat?: number | null; lng?: number | null }
) {
  const { data: warehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .insert({ name: `${store.name} (Merchant)`, address_line: store.address_line, ...(store.lat != null && store.lng != null ? { lat: store.lat, lng: store.lng } : {}) })
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

  await notifyUsers([store.owner_id], {
    title: "You're approved to sell on FasTrack!",
    body: `${store.name} has been approved. You can now add products and start selling.`,
    url: "/merchant",
  });
  await sendApplicationDecisionEmail(
    store.owner_id,
    "You're approved to sell on FasTrack",
    `${store.name} has been approved. You can now add products and start selling.`,
    "/merchant"
  );
}

export async function rejectStore(storeId: string, reason: string) {
  const supabase = await createClient();
  const rejectionReason = reason || "Application did not meet requirements.";
  const { data: store, error } = await supabase
    .from("stores")
    .update({ status: "rejected", rejection_reason: rejectionReason })
    .eq("id", storeId)
    .select("owner_id, name")
    .maybeSingle();
  if (error) throw error;

  revalidatePath("/admin/merchants");

  if (store) {
    await notifyUsers([store.owner_id], {
      title: "Update on your supplier application",
      body: rejectionReason,
      url: "/sell",
    });
    await sendApplicationDecisionEmail(
      store.owner_id,
      `Update on your FasTrack application — ${store.name}`,
      rejectionReason,
      "/sell"
    );
  }
}

export async function suspendStore(storeId: string) {
  const supabase = await createClient();
  const { data: store, error } = await supabase
    .from("stores")
    .update({ status: "suspended" })
    .eq("id", storeId)
    .select("owner_id, name")
    .maybeSingle();
  if (error) throw error;
  revalidatePath("/admin/merchants");

  if (store) {
    await notifyUsers([store.owner_id], {
      title: "Your store has been suspended",
      body: `${store.name} has been suspended. Contact support for details.`,
      url: "/merchant",
    });
    await sendApplicationDecisionEmail(
      store.owner_id,
      `Your FasTrack store has been suspended — ${store.name}`,
      "Contact support for details.",
      "/merchant"
    );
  }
}

export async function reinstateStore(storeId: string) {
  const supabase = await createClient();
  const { data: store, error } = await supabase
    .from("stores")
    .update({ status: "approved" })
    .eq("id", storeId)
    .select("owner_id, name")
    .maybeSingle();
  if (error) throw error;
  revalidatePath("/admin/merchants");

  if (store) {
    await notifyUsers([store.owner_id], {
      title: "Your store is active again",
      body: `${store.name} has been reinstated. You can resume selling on FasTrack.`,
      url: "/merchant",
    });
    await sendApplicationDecisionEmail(
      store.owner_id,
      `Your FasTrack store is active again — ${store.name}`,
      "Your suspension has been lifted. You can resume selling on FasTrack.",
      "/merchant"
    );
  }
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
  /** India (the admin's market): GSTIN, PAN, FSSAI, state, city and bank account. */
  india?: IndiaSupplierValue;
}

/** Admin adding a merchant directly: skips the applicant flow and is approved immediately. */
export async function adminCreateMerchant(input: AdminCreateMerchantInput) {
  const supabase = await createClient();
  // The market being administered decides which business details apply.
  const isIndia = ((await getCurrentTenant())?.country_code ?? "SA") === "IN";

  let identity: Record<string, string | null>;
  if (isIndia) {
    if (!input.india) throw new Error("Please fill in the GST, PAN and bank details.");
    const problem = validateIndiaSupplier(input.india);
    if (problem) throw new Error(problem);
    const bank = checkIndianBankDetails({
      bankName: input.india.bankName,
      accountNumber: input.india.accountNumber,
      ifsc: input.india.ifsc,
      holder: input.india.accountHolder,
    });
    identity = {
      // As in the supplier's own application: PAN in the CR slot, GSTIN in the VAT slot.
      cr_number: checkPan(input.india.pan).value,
      vat_number: checkGstin(input.india.gstin).value,
      city: input.india.city.trim(),
      country: "India",
      state: input.india.state,
      fssai_number: input.india.fssai.trim() ? checkFssai(input.india.fssai).value : null,
      bank_name: input.india.bankName.trim(),
      bank_account_number: bank.accountNumber,
      bank_ifsc: bank.ifsc,
      bank_account_holder: input.india.accountHolder.trim(),
    };
  } else {
    if ((input.country || "Saudi Arabia").trim().toLowerCase() === "saudi arabia") {
      const problem = checkCrNumber(input.crNumber).error ?? checkVatNumber(input.vatNumber ?? "").error;
      if (problem) throw new Error(problem);
    }
    identity = {
      cr_number: input.crNumber,
      vat_number: input.vatNumber || null,
      city: input.city || "Riyadh",
      country: input.country || "Saudi Arabia",
    };
  }

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
      ...identity,
      contact_phone: input.contactPhone || null,
      address_line: input.addressLine || null,
      status: "pending",
    })
    .select("id, name, address_line, owner_id")
    .single();
  if (insertError) throw insertError;

  await finalizeApproval(supabase, store);
  revalidatePath("/admin/merchants");
  return store.id as string;
}

/** Admin editing a shop's page on its behalf: logo, cover, tagline, opening
 * hours and the pause-orders switch. RLS ("admins manage stores") is what
 * actually restricts this to admins. */
export async function adminUpdateStoreProfile(input: {
  storeId: string;
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
  openingHours: unknown;
  acceptingOrders: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .update({
      logo_url: input.logoUrl,
      cover_url: input.coverUrl,
      tagline: input.tagline.trim().slice(0, 80) || null,
      opening_hours: sanitizeOpeningHours(input.openingHours),
      accepting_orders: input.acceptingOrders,
    })
    .eq("id", input.storeId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Only admins can edit a shop's page.");

  revalidatePath(`/admin/merchants/${input.storeId}`);
  revalidatePath("/admin/merchants");
  revalidatePath(`/store/${input.storeId}`);
}
