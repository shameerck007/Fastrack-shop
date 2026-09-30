"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";
import { sendNewApplicationEmails } from "@/lib/email-notifications";

export async function applyAsRider(input: {
  fullName: string;
  phone: string;
  vehicleType: string;
  licenseNumber: string;
  licenseDocumentPath: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  if (!input.fullName.trim() || !input.phone.trim() || !input.licenseNumber.trim()) {
    throw new Error("Name, phone and license number are required.");
  }
  if (!input.licenseDocumentPath) {
    throw new Error("Please upload a photo of your driver's license.");
  }

  // Keep the profile's own name/phone in sync — riders never got a separate
  // profile-edit page, so the application form doubles as one.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), phone: input.phone.trim() })
    .eq("id", user.id);
  if (profileError) throw profileError;

  // "users apply as own rider" RLS (0028) only allows status='pending' here
  // — a self-insert can never come in pre-approved.
  const { error } = await supabase.from("delivery_partners").insert({
    id: user.id,
    vehicle_type: input.vehicleType,
    license_number: input.licenseNumber.trim(),
    license_document_path: input.licenseDocumentPath,
    status: "pending",
    is_available: false,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already submitted a rider application.");
    }
    throw error;
  }

  revalidatePath("/deliver");

  await notifyAdmins({
    title: "New rider application",
    body: `${input.fullName.trim()} applied to ride for FasTrack.`,
    url: "/admin/riders",
  });
  await sendNewApplicationEmails(
    "New rider application",
    `${input.fullName.trim()} applied to ride for FasTrack.`,
    "/admin/riders"
  );
}
