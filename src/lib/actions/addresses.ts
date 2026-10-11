"use server";


import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AddressLabel } from "@/types/database";
import { getCurrentTenant } from "@/lib/tenant-server";
import { SERVICE_AREA_MESSAGE, checkPinCode, isIndianState, pinMatchesState, stateInServiceArea } from "@/lib/india";
import { validatePhone } from "@/lib/countries";

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
  receiverName?: string;
  receiverPhone?: string;
  state?: string;
  landmark?: string;
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
    receiver_name: input.receiverName || null,
    receiver_phone: input.receiverPhone || null,
    state: input.state?.trim() || null,
    landmark: input.landmark?.trim() || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  };
}

/** Market rules checked on the server too, so a tampered request can't save a bad address. */
async function assertAddressValid(input: AddressInput) {
  const country = (await getCurrentTenant())?.country_code ?? "SA";
  if (country === "IN") {
    if (!input.city?.trim()) throw new UserError("Enter the town or city.");
    if (!input.state || !isIndianState(input.state)) throw new UserError("Choose the state.");
    if (!stateInServiceArea(country, input.state)) throw new UserError(SERVICE_AREA_MESSAGE);
    const pin = checkPinCode(input.postalCode ?? "");
    if (!pin.ok) throw new UserError(pin.error ?? "Check the PIN code.");
    if (!pinMatchesState(input.state, pin.value)) throw new UserError(`That PIN code doesn't look like a ${input.state} PIN code.`);
  }
  if (input.receiverPhone) {
    const phone = validatePhone(input.receiverPhone);
    if (!phone.ok) throw new UserError(phone.error ?? "Enter a valid mobile number.");
  }
}

/** Landmark/state columns come from migrations 0047/0048 — until applied, save without them. */
function withoutNewColumns<T extends { state?: unknown; landmark?: unknown }>(row: T) {
  const { state: _s, landmark: _l, ...rest } = row;
  return rest;
}


export async function addAddress(input: AddressInput) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  await assertAddressValid(input);
  let { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      ...toRow(input),
    })
    .select("id")
    .single();
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await supabase
      .from("addresses")
      .insert({ user_id: user.id, ...withoutNewColumns(toRow(input)) })
      .select("id")
      .single());
  }
  if (error || !data) throw error ?? new Error("Could not save the address.");
  revalidatePath("/checkout");
  revalidatePath("/addresses");
  return await data.id as string;

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updateAddress(addressId: string, input: AddressInput) {
  try {
  const supabase = await createClient();
  await assertAddressValid(input);
  let { error } = await supabase.from("addresses").update(toRow(input)).eq("id", addressId);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("addresses").update(withoutNewColumns(toRow(input))).eq("id", addressId));
  }
  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function deleteAddress(addressId: string) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", addressId);
  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function setDefaultAddress(addressId: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

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

  } catch (e) {
    return failure(e) as never;
  }
}
