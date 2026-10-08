"use server";

import { checkCrNumber, checkVatNumber } from "@/lib/saudi-tax";
import { getCurrentTenant } from "@/lib/tenant-server";
import {
  checkFssai,
  checkGstin,
  checkIndianBankDetails,
  checkPan,
  validateIndiaSupplier,
  type IndiaSupplierValue,
} from "@/lib/india-business";
import { validatePhone } from "@/lib/countries";
import { checkSaudiIban, IBAN_PROBLEM_MESSAGES } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
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
  /** India suppliers: GSTIN, PAN, FSSAI, state, city and bank account (checked here as well). */
  india?: IndiaSupplierValue;
  contactPhone?: string;
  addressLine?: string;
  /** The shop's pin on the map. */
  lat?: number;
  lng?: number;
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

  const country = (await getCurrentTenant())?.country_code ?? "SA";
  const isIndia = country === "IN";

  if (!input.name.trim()) throw new Error("Store name is required.");
  if (!input.crDocumentPath) {
    throw new Error(isIndia ? "Please upload a copy of your GST registration certificate." : "Please upload a copy of your CR document.");
  }

  // Payouts go to this account, so it is re-checked here, not just in the form.
  const phoneCheck = validatePhone(input.contactPhone?.trim() ?? "");
  if (!phoneCheck.ok) throw new Error(phoneCheck.error ?? "Enter a valid mobile number.");

  let identity: {
    cr_number: string;
    vat_number: string | null;
    bank_iban: string | null;
    bank_name: string | null;
    city: string;
    country: string;
    state: string | null;
    fssai_number: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_account_holder: string | null;
  };

  if (isIndia) {
    if (!input.india) throw new Error("Please fill in the GST, PAN and bank details.");
    const problem = validateIndiaSupplier(input.india);
    if (problem) throw new Error(problem);
    const gstin = checkGstin(input.india.gstin);
    const bank = checkIndianBankDetails({
      bankName: input.india.bankName,
      accountNumber: input.india.accountNumber,
      ifsc: input.india.ifsc,
      holder: input.india.accountHolder,
    });
    identity = {
      // For Indian suppliers the PAN takes the place of the CR number and the GSTIN of the VAT number.
      cr_number: checkPan(input.india.pan).value,
      vat_number: gstin.value,
      bank_iban: null,
      bank_name: input.india.bankName.trim(),
      city: input.india.city.trim(),
      country: "India",
      state: input.india.state,
      fssai_number: input.india.fssai.trim() ? checkFssai(input.india.fssai).value : null,
      bank_account_number: bank.accountNumber,
      bank_ifsc: bank.ifsc,
      bank_account_holder: input.india.accountHolder.trim(),
    };
  } else {
    if (!input.crNumber.trim()) throw new Error("Store name and CR number are required.");
    const crCheck = checkCrNumber(input.crNumber);
    if (!crCheck.ok) throw new Error(crCheck.error ?? "Check the CR number.");
    const vatCheck = checkVatNumber(input.vatNumber ?? "");
    if (!vatCheck.ok) throw new Error(vatCheck.error ?? "Check the VAT number.");
    const ibanShape = checkSaudiIban(input.bankIban ?? "");
    if (!ibanShape.ok) throw new Error(IBAN_PROBLEM_MESSAGES[ibanShape.problem!]);
    const bankCheck = checkBankDetails(input.bankName?.trim() ?? "", input.bankIban ?? "");
    if (!bankCheck.ok) throw new Error(bankCheck.error ?? "Check the bank details.");
    identity = {
      cr_number: crCheck.value,
      vat_number: vatCheck.value || null,
      bank_iban: bankCheck.iban,
      bank_name: input.bankName?.trim() || null,
      city: input.city?.trim() || "Riyadh",
      country: "Saudi Arabia",
      state: null,
      fssai_number: null,
      bank_account_number: null,
      bank_ifsc: null,
      bank_account_holder: null,
    };
  }

  const hasPin = typeof input.lat === "number" && typeof input.lng === "number" && Number.isFinite(input.lat) && Number.isFinite(input.lng);
  if (!hasPin) throw new Error("Please mark your shop on the map.");
  if (Math.abs(input.lat as number) > 90 || Math.abs(input.lng as number) > 180) throw new Error("That map location isn't valid.");

  const row = {
    owner_id: user.id,
    lat: input.lat as number,
    lng: input.lng as number,
    name: input.name.trim(),
    ...identity,
    contact_phone: input.contactPhone?.trim() || null,
    address_line: input.addressLine?.trim() || null,
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
    // Optional columns (branding, India fields) come from migrations; drop them if missing.
    const {
      logo_url, cover_url, tagline, opening_hours, state, fssai_number, lat, lng, bank_account_number, bank_ifsc, bank_account_holder, ...basic
    } = row;
    void logo_url; void cover_url; void tagline; void opening_hours;
    void lat; void lng; void state; void fssai_number; void bank_account_number; void bank_ifsc; void bank_account_holder;
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
