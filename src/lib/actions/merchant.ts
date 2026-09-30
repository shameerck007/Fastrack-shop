"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";
import { sendNewApplicationEmails } from "@/lib/email-notifications";

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

  const { error } = await supabase.from("stores").insert({
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
  });

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
