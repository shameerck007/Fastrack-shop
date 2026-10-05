"use server";

import { validatePhone } from "@/lib/countries";
import { checkSaudiIban, IBAN_PROBLEM_MESSAGES } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
import { needsVehicleDocs, checkAdult, checkIdNumber, checkNotExpired, checkPlate, type IdType } from "@/lib/rider-validation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";
import { sendNewApplicationEmails } from "@/lib/email-notifications";

export interface RiderApplicationInput {
  fullName: string;
  phone: string;
  city: string;
  idType: IdType;
  idNumber: string;
  nationality: string;
  dateOfBirth: string;
  idFrontPath: string;
  idBackPath: string;
  selfiePath: string;
  vehicleType: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseDocumentPath: string;
  vehiclePlate?: string;
  vehicleMakeModel?: string;
  vehicleYear?: number | null;
  registrationPath?: string | null;
  registrationExpiry?: string;
  insurancePath?: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  payoutMethod: "bank" | "cash";
  bankName?: string;
  bankIban?: string;
  bankAccountHolder?: string;
  acceptedTerms: boolean;
}

export async function applyAsRider(input: RiderApplicationInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  if (!input.fullName.trim()) throw new Error("Enter your full name.");
  const phoneCheck = { ...validatePhone(input.phone.trim()), value: input.phone.trim() };
  if (!phoneCheck.ok) throw new Error(phoneCheck.error ?? "Enter a valid mobile number.");
  const idCheck = checkIdNumber(input.idType, input.idNumber);
  if (!idCheck.ok) throw new Error(idCheck.error ?? "Check the ID number.");
  const ageProblem = checkAdult(input.dateOfBirth);
  if (ageProblem) throw new Error(ageProblem);
  if (!input.idFrontPath || !input.idBackPath) throw new Error("Upload the front and back of your ID.");
  if (!input.selfiePath) throw new Error("Upload a selfie.");
  if (!input.licenseNumber.trim()) throw new Error("Enter your driving licence number.");
  const licenseProblem = checkNotExpired(input.licenseExpiry, "driving licence");
  if (licenseProblem) throw new Error(licenseProblem);
  if (!input.licenseDocumentPath) throw new Error("Please upload a photo of your driver's license.");

  if (needsVehicleDocs(input.vehicleType)) {
    const plateProblem = checkPlate(input.vehiclePlate ?? "");
    if (plateProblem) throw new Error(plateProblem);
    if (!input.registrationPath) throw new Error("Upload the vehicle registration (Istimara).");
    const regProblem = checkNotExpired(input.registrationExpiry ?? "", "vehicle registration");
    if (regProblem) throw new Error(regProblem);
  }

  const emergencyPhone = validatePhone(input.emergencyContactPhone.trim());
  if (!input.emergencyContactName.trim() || !emergencyPhone.ok) {
    throw new Error("Enter an emergency contact name and a valid mobile number.");
  }

  let bankName: string | null = null;
  let bankIban: string | null = null;
  let bankHolder: string | null = null;
  if (input.payoutMethod === "bank") {
    const ibanShape = checkSaudiIban(input.bankIban ?? "");
    if (!ibanShape.ok) throw new Error(IBAN_PROBLEM_MESSAGES[ibanShape.problem!]);
    const bankCheck = checkBankDetails(input.bankName?.trim() ?? "", input.bankIban ?? "");
    if (!bankCheck.ok) throw new Error(bankCheck.error ?? "Check the bank details.");
    if (!input.bankAccountHolder?.trim()) throw new Error("Enter the account holder name.");
    bankName = input.bankName!.trim();
    bankIban = bankCheck.iban;
    bankHolder = input.bankAccountHolder.trim();
  }
  if (!input.acceptedTerms) throw new Error("Please accept the rider terms to continue.");

  // Keep the profile's own name/phone in sync — riders never got a separate
  // profile-edit page, so the application form doubles as one.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), phone: phoneCheck.value })
    .eq("id", user.id);
  if (profileError) throw profileError;

  // "users apply as own rider" RLS (0028) only allows status='pending' here
  // — a self-insert can never come in pre-approved.
  const baseRow = {
    id: user.id,
    vehicle_type: input.vehicleType,
    license_number: input.licenseNumber.trim(),
    license_document_path: input.licenseDocumentPath,
    status: "pending",
    is_available: false,
  };
  const fullRow = {
    ...baseRow,
    id_type: input.idType,
    id_number: idCheck.value,
    nationality: input.nationality.trim() || null,
    date_of_birth: input.dateOfBirth,
    city: input.city.trim() || null,
    id_front_path: input.idFrontPath,
    id_back_path: input.idBackPath,
    selfie_path: input.selfiePath,
    license_expiry: input.licenseExpiry,
    vehicle_plate: input.vehiclePlate?.trim() || null,
    vehicle_make_model: input.vehicleMakeModel?.trim() || null,
    vehicle_year: input.vehicleYear ?? null,
    registration_path: input.registrationPath ?? null,
    registration_expiry: input.registrationExpiry || null,
    insurance_path: input.insurancePath ?? null,
    emergency_contact_name: input.emergencyContactName.trim(),
    emergency_contact_phone: input.emergencyContactPhone.trim(),
    payout_method: input.payoutMethod,
    bank_name: bankName,
    bank_iban: bankIban,
    bank_account_holder: bankHolder,
    terms_accepted_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("delivery_partners").insert(fullRow);
  // The extra onboarding columns arrive with a database migration — if it
  // hasn't been applied yet, still accept the application without them.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ error } = await supabase.from("delivery_partners").insert(baseRow));
  }

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
