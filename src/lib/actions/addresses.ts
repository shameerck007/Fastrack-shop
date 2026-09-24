"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AddressLabel } from "@/types/database";

export async function addAddress(input: {
  label: AddressLabel;
  addressLine: string;
  city?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: input.label,
    address_line: input.addressLine,
    city: input.city ?? "Riyadh",
  });

  if (error) throw error;
  revalidatePath("/checkout");
  revalidatePath("/addresses");
}
