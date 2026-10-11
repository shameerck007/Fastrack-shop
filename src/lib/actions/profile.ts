"use server";


import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Only ever writes these two columns, named explicitly — never spreads or
// forwards arbitrary client input into the update. profiles' RLS policy
// ("users and admins update profile") allows a user to update *any* column
// on their own row, including `role`; the safety boundary here is entirely
// this action never accepting or passing through a role field, not RLS.
export async function updateProfile(input: { fullName: string; phone?: string }) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const fullName = input.fullName.trim();
  if (!fullName) throw new UserError("Name is required.");

  const phone = input.phone?.trim() || null;
  if (phone) {
    const { data: taken } = await supabase.rpc("is_phone_registered", {
      target_phone: phone,
      exclude_user_id: user.id,
    });
    if (taken) throw new UserError("This mobile number is already registered to another account.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/account");
  revalidatePath("/account/security");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updatePassword(newPassword: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");
  if (newPassword.length < 8) throw new UserError("Password must be at least 8 characters.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}
