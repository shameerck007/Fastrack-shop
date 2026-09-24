"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AddressLabel } from "@/types/database";

export interface AddressInput {
  label: AddressLabel;
  addressLine: string;
  city?: string;
  district?: string;
  buildingNumber?: string;
  additionalNumber?: string;
  unitNumber?: string;
  postalCode?: string;
  shortAddress?: string;
  lat?: number;
  lng?: number;
}

function toRow(input: AddressInput) {
  return {
    label: input.label,
    address_line: input.addressLine,
    city: input.city || "Riyadh",
    district: input.district || null,
    building_number: input.buildingNumber || null,
    additional_number: input.additionalNumber || null,
    unit_number: input.unitNumber || null,
    postal_code: input.postalCode || null,
    short_address: input.shortAddress || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  };
}

export async function addAddress(input: AddressInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    ...toRow(input),
  });

  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");
}

export async function updateAddress(addressId: string, input: AddressInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").update(toRow(input)).eq("id", addressId);
  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");
}

export async function deleteAddress(addressId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", addressId);
  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");
}

export async function setDefaultAddress(addressId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  // Clear any existing default first — RLS scopes this to the caller's own
  // rows, so it can't touch other users' addresses.
  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId);
  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");
}
