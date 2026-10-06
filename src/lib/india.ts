// India-specific data and checks, shared by the browser and the server.

export const INDIAN_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

/** A PIN code is exactly 6 digits and never starts with 0. */
export function checkPinCode(raw: string): { ok: boolean; error: string | null; value: string } {
  const value = raw.replace(/\D/g, "");
  if (!value) return { ok: false, error: "Enter the PIN code.", value };
  if (value.length !== 6) return { ok: false, error: "A PIN code has exactly 6 digits.", value };
  if (value.startsWith("0")) return { ok: false, error: "A PIN code doesn't start with 0.", value };
  return { ok: true, error: null, value };
}

export function isIndianState(name: string): boolean {
  return INDIAN_STATES.includes(name);
}

/** Where each market delivers for now. India starts with Kerala; add states here as the service opens elsewhere. */
export const SERVICE_STATES: Record<string, string[]> = { IN: ["Kerala"] };

/** The states a market delivers to; null when the whole country is served. */
export function serviceStatesFor(countryCode: string | null | undefined): string[] | null {
  return SERVICE_STATES[(countryCode ?? "").toUpperCase()] ?? null;
}

/** Can an address in this state be delivered to? Markets without a restriction accept everything. */
export function stateInServiceArea(countryCode: string | null | undefined, state: string | null | undefined): boolean {
  const allowed = serviceStatesFor(countryCode);
  return !allowed || (!!state && allowed.includes(state));
}

/** Kerala PIN codes start with 67, 68 or 69 (670001 - 695615). */
export function pinMatchesState(state: string, pin: string): boolean {
  if (state === "Kerala") return /^6[789]/.test(pin);
  return true;
}

export const SERVICE_AREA_MESSAGE = "We currently deliver in Kerala only. More areas are coming soon.";
