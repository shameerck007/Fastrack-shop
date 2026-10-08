"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAsRider } from "@/lib/actions/rider-application";
import RiderDocumentUploader from "@/components/rider/RiderDocumentUploader";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import BankFields from "@/components/merchant/BankFields";
import TaxIdInput from "@/components/TaxIdInput";
import { COUNTRIES, validatePhone } from "@/lib/countries";
import { checkSaudiIban, IBAN_PROBLEM_MESSAGES } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
import {
  checkAdult,
  checkIdNumber,
  checkNotExpired,
  checkIndianLicence,
  checkIndianPlate,
  checkPlate,
  needsVehicleDocs,
  type IdType,
} from "@/lib/rider-validation";
import { useLocale } from "@/components/LocaleProvider";
import { useMarket } from "@/components/MoneyProvider";
import CodeInput from "@/components/CodeInput";
import IndianBankFields from "@/components/merchant/IndianBankFields";
import { checkIndianBankDetails } from "@/lib/india-business";
import Select from "@/components/ui/Select";

const STEPS = ["Personal", "ID", "Vehicle", "Payout", "Review"] as const;
const inputClass = "w-full min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const CITIES_SA = ["Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar", "Dhahran", "Taif", "Tabuk", "Abha", "Buraidah", "Other"];
// India launches in Kerala: riders pick their Kerala city.
const CITIES_IN = ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kannur", "Kollam", "Kottayam", "Alappuzha", "Palakkad", "Malappuram", "Other"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

export default function RiderApplicationForm() {
  const { t } = useLocale();
  const { countryCode } = useMarket();
  const isIndia = countryCode === "IN";
  const CITIES = isIndia ? CITIES_IN : CITIES_SA;
  const [step, setStep] = useState(0);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(isIndia ? "Kochi" : "Riyadh");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState(isIndia ? "India" : "Saudi Arabia");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [idType, setIdType] = useState<IdType>(isIndia ? "aadhaar" : "national_id");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontPath, setIdFrontPath] = useState<string | null>(null);
  const [idBackPath, setIdBackPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);

  const [vehicleType, setVehicleType] = useState("motorbike");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseDocumentPath, setLicenseDocumentPath] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [registrationPath, setRegistrationPath] = useState<string | null>(null);
  const [registrationExpiry, setRegistrationExpiry] = useState("");
  const [insurancePath, setInsurancePath] = useState<string | null>(null);

  const [payoutMethod, setPayoutMethod] = useState<"bank" | "cash">("cash");
  const [bank, setBank] = useState({ bankName: "", iban: "" });
  const [accountHolder, setAccountHolder] = useState("");
  const [inBank, setInBank] = useState({ bankName: "", accountHolder: "", accountNumber: "", ifsc: "" });

  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /** Returns the first problem on a step, or null when it's good to move on. */
  function problemOn(s: number): string | null {
    if (s === 0) {
      if (!fullName.trim()) return "Enter your full name.";
      const p = validatePhone(phone);
      if (!p.ok) return p.error;
      const age = checkAdult(dateOfBirth);
      if (age) return age;
      if (!emergencyName.trim()) return "Enter an emergency contact name.";
      const e = validatePhone(emergencyPhone);
      if (!e.ok) return `Emergency contact: ${e.error}`;
    }
    if (s === 1) {
      const id = checkIdNumber(idType, idNumber);
      if (!id.ok) return id.error;
      if (!idFrontPath || (idType !== "pan" && !idBackPath)) return idType === "pan" ? "Upload a photo of your PAN card." : "Upload the front and back of your ID.";
      if (!selfiePath) return "Upload a selfie.";
    }
    if (s === 2) {
      if (isIndia) {
        const lic = checkIndianLicence(licenseNumber);
        if (!lic.ok) return lic.error;
      } else if (!licenseNumber.trim()) return "Enter your driving licence number.";
      const lic = checkNotExpired(licenseExpiry, "driving licence");
      if (lic) return lic;
      if (!licenseDocumentPath) return t("become_rider.license_required");
      if (needsVehicleDocs(vehicleType)) {
        const pl = isIndia ? checkIndianPlate(plate) : checkPlate(plate);
        if (pl) return pl;
        if (!registrationPath) return isIndia ? "Upload the vehicle registration certificate (RC)." : "Upload the vehicle registration (Istimara).";
        const reg = checkNotExpired(registrationExpiry, "vehicle registration");
        if (reg) return reg;
      }
    }
    if (s === 3 && payoutMethod === "bank" && isIndia) {
      const bc = checkIndianBankDetails({ bankName: inBank.bankName, accountNumber: inBank.accountNumber, ifsc: inBank.ifsc, holder: inBank.accountHolder });
      if (!bc.ok) return bc.error;
    }
    if (s === 3 && payoutMethod === "bank" && !isIndia) {
      const shape = checkSaudiIban(bank.iban);
      if (!shape.ok) return IBAN_PROBLEM_MESSAGES[shape.problem!];
      const bc = checkBankDetails(bank.bankName, bank.iban);
      if (!bc.ok) return bc.error;
      if (!accountHolder.trim()) return "Enter the account holder name (as on the bank account).";
    }
    return null;
  }

  function next() {
    const problem = problemOn(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    for (let s = 0; s < 4; s++) {
      const problem = problemOn(s);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    if (!accepted) {
      setError("Please accept the rider terms to continue.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await applyAsRider({
          fullName,
          phone,
          city,
          idType,
          idNumber,
          nationality,
          dateOfBirth,
          idFrontPath: idFrontPath!,
          idBackPath: idBackPath!,
          selfiePath: selfiePath!,
          vehicleType,
          licenseNumber,
          licenseExpiry,
          licenseDocumentPath: licenseDocumentPath!,
          vehiclePlate: plate,
          vehicleMakeModel: makeModel,
          vehicleYear: vehicleYear ? Number(vehicleYear) : null,
          registrationPath,
          registrationExpiry,
          insurancePath,
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
          payoutMethod,
          bankName: isIndia ? inBank.bankName : bank.bankName,
          bankIban: isIndia ? undefined : bank.iban,
          bankAccountHolder: isIndia ? inBank.accountHolder : accountHolder,
          bankAccountNumber: isIndia ? inBank.accountNumber : undefined,
          bankIfsc: isIndia ? inBank.ifsc : undefined,
          acceptedTerms: accepted,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("become_rider.could_not_submit"));
      }
    });
  }

  const docHint = "Clear photo or PDF, up to 10 MB.";

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      {/* progress */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-blue-700">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-blue-600" : "bg-neutral-200"}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {step === 0 && (
          <>
            <Field label={t("become_rider.full_name")} hint="As written on your ID.">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("become_rider.phone")}>
              <PhoneNumberInput value={phone} onChange={setPhone} placeholder={isIndia ? "98XXXXXXXX" : "5X XXX XXXX"} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth">
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
              </Field>
              <Field label="City you'll ride in">
                <Select value={city} onChange={(e) => setCity(e.target.value)} className={`${inputClass} bg-white`}>
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nationality">
              <Select value={nationality} onChange={(e) => setNationality(e.target.value)} className={`${inputClass} bg-white`}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-1 border-t border-neutral-100 pt-3">
              <p className="mb-2 text-sm font-semibold">Emergency contact</p>
              <div className="flex flex-col gap-3">
                <Field label="Contact name">
                  <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Contact mobile number">
                  <PhoneNumberInput value={emergencyPhone} onChange={setEmergencyPhone} placeholder={isIndia ? "98XXXXXXXX" : "5X XXX XXXX"} />
                </Field>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="ID type">
              <div className="grid grid-cols-2 gap-2">
                {(
                  (isIndia
                    ? [
                        ["aadhaar", "Aadhaar card"],
                        ["pan", "PAN card"],
                      ]
                    : [
                        ["national_id", "Saudi national ID"],
                        ["iqama", "Iqama (resident)"],
                      ]) as [IdType, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setIdType(value);
                      setIdNumber("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      idType === value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ID number">
              {idType === "pan" ? (
                <CodeInput value={idNumber} maxLength={10} placeholder="ABCDE1234F" check={(raw) => checkIdNumber("pan", raw)} onChange={setIdNumber} />
              ) : idType === "aadhaar" ? (
                <TaxIdInput value={idNumber} onChange={setIdNumber} check={(raw) => checkIdNumber("aadhaar", raw)} length={12} placeholder="12 digits" />
              ) : (
                <TaxIdInput value={idNumber} onChange={setIdNumber} check={(raw) => checkIdNumber(idType, raw)} length={10} placeholder="10 digits" />
              )}
            </Field>
            <RiderDocumentUploader prefix="id-front" label="ID — front" hint={docHint} value={idFrontPath} onChange={setIdFrontPath} />
            {idType !== "pan" && (
              <RiderDocumentUploader prefix="id-back" label="ID — back" hint={docHint} value={idBackPath} onChange={setIdBackPath} />
            )}
            <RiderDocumentUploader
              prefix="selfie"
              label="Selfie"
              hint="A clear photo of your face, no sunglasses or cap — we match it to your ID."
              value={selfiePath}
              onChange={setSelfiePath}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Field label={t("become_rider.vehicle_type")}>
              <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="motorbike">{t("become_rider.vehicle_motorbike")}</option>
                <option value="car">{t("become_rider.vehicle_car")}</option>
                <option value="bicycle">{t("become_rider.vehicle_bicycle")}</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("become_rider.license_number")}>
                <input value={licenseNumber} onChange={(e) => setLicenseNumber(isIndia ? e.target.value.toUpperCase() : e.target.value)} placeholder={isIndia ? "DL0420110149646" : undefined} className={inputClass} />
              </Field>
              <Field label="Licence expiry">
                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <RiderDocumentUploader
              label={t("become_rider.license_document")}
              value={licenseDocumentPath}
              onChange={setLicenseDocumentPath}
            />

            {needsVehicleDocs(vehicleType) && (
              <div className="mt-1 flex flex-col gap-3 border-t border-neutral-100 pt-3">
                <p className="text-sm font-semibold">Vehicle details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plate number">
                    <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder={isIndia ? "MH12AB1234" : "ABC 1234"} className={inputClass} />
                  </Field>
                  <Field label="Year (optional)">
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value.replace(/\D/g, ""))}
                      placeholder="2022"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Make & model (optional)">
                  <input value={makeModel} onChange={(e) => setMakeModel(e.target.value)} placeholder="Honda CB125" className={inputClass} />
                </Field>
                <RiderDocumentUploader
                  prefix="registration"
                  label={isIndia ? "Vehicle registration certificate (RC)" : "Vehicle registration (Istimara)"}
                  hint={docHint}
                  value={registrationPath}
                  onChange={setRegistrationPath}
                />
                <Field label="Registration expiry">
                  <input type="date" value={registrationExpiry} onChange={(e) => setRegistrationExpiry(e.target.value)} className={inputClass} />
                </Field>
                <RiderDocumentUploader
                  prefix="insurance"
                  label="Insurance (optional)"
                  hint={docHint}
                  value={insurancePath}
                  onChange={setInsurancePath}
                />
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-neutral-600">How would you like to receive your earnings?</p>
            <div className="grid gap-2">
              {(
                [
                  ["cash", "💵 Cash", "Collect your earnings in cash from the FasTrack office."],
                  ["bank", "🏦 Bank transfer", isIndia ? "Paid to your bank account (account number + IFSC)." : "Paid to your Saudi bank account (IBAN)."],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPayoutMethod(value)}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    payoutMethod === value ? "border-blue-600 bg-blue-50" : "border-neutral-300"
                  }`}
                >
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-neutral-500">{desc}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400">You can change this later by contacting support.</p>
            {payoutMethod === "bank" && isIndia && (
              <div className="border-t border-neutral-100 pt-3">
                <IndianBankFields value={inBank} onChange={setInBank} />
              </div>
            )}
            {payoutMethod === "bank" && !isIndia && (
              <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3">
                <BankFields value={bank} onChange={setBank} />
                <Field label="Account holder name *" hint="Must match the name on your ID.">
                  <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className={inputClass} />
                </Field>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
              {[
                ["Name", fullName],
                ["Mobile", phone],
                ["City", city],
                ["ID", `${({ iqama: "Iqama", national_id: "National ID", aadhaar: "Aadhaar", pan: "PAN" } as Record<string, string>)[idType]} ${idNumber}`],
                ["Vehicle", `${vehicleType}${needsVehicleDocs(vehicleType) && plate ? ` · ${plate}` : ""}`],
                ["Licence expiry", licenseExpiry],
                ["Payout", payoutMethod === "bank" ? `Bank · ${bank.bankName}` : "Cash"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2">
                  <span className="text-neutral-500">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
              <span>
                I confirm the information and documents are mine and correct, and I agree to FasTrack&apos;s{" "}
                <a href="/terms" target="_blank" className="text-blue-600 underline">
                  terms
                </a>
                .
              </span>
            </label>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={back} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50">
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="rounded-full bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800">
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-full bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? t("become_rider.submitting") : t("become_rider.submit_application")}
          </button>
        )}
      </div>
    </div>
  );
}
