"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push";
import { sendApplicationDecisionEmail } from "@/lib/email-notifications";

export async function approveRider(riderId: string) {
  const supabase = await createClient();

  const { error: riderError } = await supabase
    .from("delivery_partners")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", riderId);
  if (riderError) throw riderError;

  const { error: profileError } = await supabase.from("profiles").update({ role: "rider" }).eq("id", riderId);
  if (profileError) throw profileError;

  revalidatePath("/admin/riders");

  await notifyUsers([riderId], {
    title: "You're approved to ride!",
    body: "Your FasTrack rider application has been approved. Go online to start receiving deliveries.",
    url: "/rider",
  });
  await sendApplicationDecisionEmail(
    riderId,
    "You're approved to ride with FasTrack",
    "Your rider application has been approved. Go online to start receiving deliveries.",
    "/rider"
  );
}

export async function rejectRider(riderId: string, reason: string) {
  const supabase = await createClient();
  const rejectionReason = reason || "Application did not meet requirements.";
  const { error } = await supabase
    .from("delivery_partners")
    .update({ status: "rejected", rejection_reason: rejectionReason })
    .eq("id", riderId);
  if (error) throw error;

  revalidatePath("/admin/riders");

  await notifyUsers([riderId], {
    title: "Update on your rider application",
    body: rejectionReason,
    url: "/deliver",
  });
  await sendApplicationDecisionEmail(riderId, "Update on your FasTrack rider application", rejectionReason, "/deliver");
}

export async function suspendRider(riderId: string) {
  const supabase = await createClient();
  // is_available: false so a suspension takes effect immediately in the
  // rider pool, not just on their next toggle — is_rider() (0028) already
  // blocks them regardless, this just keeps the row's own state honest.
  const { error } = await supabase
    .from("delivery_partners")
    .update({ status: "suspended", is_available: false })
    .eq("id", riderId);
  if (error) throw error;
  revalidatePath("/admin/riders");

  await notifyUsers([riderId], {
    title: "Your rider account has been suspended",
    body: "Contact support for details.",
    url: "/rider",
  });
  await sendApplicationDecisionEmail(
    riderId,
    "Your FasTrack rider account has been suspended",
    "Contact support for details.",
    "/rider"
  );
}

export async function reinstateRider(riderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_partners").update({ status: "approved" }).eq("id", riderId);
  if (error) throw error;
  revalidatePath("/admin/riders");

  await notifyUsers([riderId], {
    title: "Your rider account is active again",
    body: "Your suspension has been lifted — you can go online and start receiving deliveries.",
    url: "/rider",
  });
  await sendApplicationDecisionEmail(
    riderId,
    "Your FasTrack rider account is active again",
    "Your suspension has been lifted — you can go online and start receiving deliveries.",
    "/rider"
  );
}

export interface FoundUser {
  id: string;
  fullName: string | null;
  role: string;
  hasStore: boolean;
}

/** Reuses admin_find_user_by_email (0024) as-is — it's a generic profile
 * lookup, not merchant-specific. `hasStore` is unused here; whether this
 * user is already a rider is checked separately below. */
export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_find_user_by_email", { p_email: email.trim() });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { id: row.id, fullName: row.full_name, role: row.role, hasStore: row.has_store };
}

export async function isAlreadyRider(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_partners").select("id").eq("id", userId).maybeSingle();
  return !!data;
}

export interface AdminCreateRiderInput {
  userId: string;
  vehicleType: string;
  licenseNumber: string;
}

/** Admin adding a rider directly: skips the applicant flow and is approved immediately. */
export async function adminCreateRider(input: AdminCreateRiderInput) {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("delivery_partners").select("id").eq("id", input.userId).maybeSingle();
  if (existing) throw new Error("This user is already registered as a rider.");

  const { error: insertError } = await supabase.from("delivery_partners").insert({
    id: input.userId,
    vehicle_type: input.vehicleType,
    license_number: input.licenseNumber.trim(),
    status: "approved",
    is_available: false,
  });
  if (insertError) throw insertError;

  const { error: profileError } = await supabase.from("profiles").update({ role: "rider" }).eq("id", input.userId);
  if (profileError) throw profileError;

  revalidatePath("/admin/riders");
  return input.userId;
}
