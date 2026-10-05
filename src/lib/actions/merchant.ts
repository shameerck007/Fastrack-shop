"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";
import { sendNewApplicationEmails } from "@/lib/email-notifications";
import { sanitizeOpeningHours } from "@/lib/store-hours";

export async function applyForStore(input: {
  name: string;
  crNumber: string;
  vatNumber?: string;
  bankName?: string;
  bankIban?: string;
  contactPhone?: string;
  addressLine?: string;
  city?: string;
  crDocumentPath?: string;
  vatDocumentPath?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  tagline?: string;
  openingHours?: unknown;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  if (!input.name.trim() || !input.crNumber.trim()) {
    throw new Error("Store name and CR number are required.");
  }
  if (!input.crDocumentPath) {
    throw new Error("Please upload a copy of your CR document.");
  }

  const row = {
    owner_id: user.id,
    name: input.name.trim(),
    cr_number: input.crNumber.trim(),
    vat_number: input.vatNumber?.trim() || null,
    bank_name: input.bankName?.trim() || null,
    bank_iban: input.bankIban?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    address_line: input.addressLine?.trim() || null,
    city: input.city?.trim() || "Riyadh",
    cr_document_path: input.crDocumentPath,
    vat_document_path: input.vatDocumentPath ?? null,
    logo_url: input.logoUrl ?? null,
    cover_url: input.coverUrl ?? null,
    tagline: input.tagline?.trim() || null,
    opening_hours: sanitizeOpeningHours(input.openingHours ?? null),
  };

  let { error } = await supabase.from("stores").insert(row);
  // Branding/hours columns arrive with a database migration — if it hasn't
  // been applied yet, still accept the application without them.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const { logo_url, cover_url, tagline, opening_hours, ...basic } = row;
    void logo_url; void cover_url; void tagline; void opening_hours;
    ({ error } = await supabase.from("stores").insert(basic));
  }

  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already submitted a store application.");
    }
    throw error;
  }

  revalidatePath("/sell");

  await notifyAdmins({
    title: "New supplier application",
    body: `${input.name.trim()} applied to sell on FasTrack.`,
    url: "/admin/merchants",
  });
  await sendNewApplicationEmails(
    "New supplier application",
    `${input.name.trim()} applied to sell on FasTrack.`,
    "/admin/merchants"
  );
}

/** Logo, cover, tagline, opening hours and the pause-orders switch — the
 * parts of a store the owner manages themselves, even after approval. */
export async function updateStoreProfile(input: {
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
  openingHours: unknown;
  acceptingOrders: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { error } = await supabase.rpc("update_own_store_profile", {
    p_logo_url: input.logoUrl,
    p_cover_url: input.coverUrl,
    p_tagline: input.tagline.slice(0, 80),
    p_opening_hours: sanitizeOpeningHours(input.openingHours),
    p_accepting_orders: input.acceptingOrders,
  });
  if (error) throw error;

  revalidatePath("/merchant");
  revalidatePath("/store");
}
