import { digitsOnly } from "@/lib/saudi-tax";
import { checkPan } from "@/lib/india-business";

export type IdType = "national_id" | "iqama" | "aadhaar" | "pan";

// Verhoeff checksum, used by the last digit of an Aadhaar number.
const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) c = V_D[c][V_P[i % 8][Number(reversed[i])]];
  return c === 0;
}

/** Identity document number: Saudi national ID (starts 1) / Iqama (starts 2), Aadhaar (12 digits) or PAN. */
export function checkIdNumber(idType: IdType, raw: string): { ok: boolean; error: string | null; value: string } {
  if (idType === "pan") return checkPan(raw);
  const value = digitsOnly(raw);
  if (!value) return { ok: false, error: "Enter the ID number.", value };
  if (idType === "aadhaar") {
    if (value.length !== 12) return { ok: false, error: "An Aadhaar number has exactly 12 digits.", value };
    if (/^[01]/.test(value)) return { ok: false, error: "An Aadhaar number doesn't start with 0 or 1.", value };
    if (!verhoeffValid(value)) return { ok: false, error: "This Aadhaar number isn't valid: one of the digits is wrong.", value };
    return { ok: true, error: null, value };
  }
  if (value.length !== 10) return { ok: false, error: "An ID number has exactly 10 digits.", value };
  const lead = idType === "national_id" ? "1" : "2";
  if (!value.startsWith(lead)) {
    return {
      ok: false,
      error: idType === "national_id" ? "A Saudi national ID starts with 1." : "An Iqama number starts with 2.",
      value,
    };
  }
  return { ok: true, error: null, value };
}

/** Indian driving licence: state code, RTO code, year and a 7-digit serial (e.g. DL0420110149646). */
export function checkIndianLicence(raw: string): { ok: boolean; error: string | null; value: string } {
  const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!value) return { ok: false, error: "Enter the driving licence number.", value };
  if (!/^[A-Z]{2}[0-9]{13}$/.test(value)) {
    return { ok: false, error: "An Indian driving licence number is 2 letters followed by 13 digits (e.g. DL0420110149646).", value };
  }
  return { ok: true, error: null, value };
}

/** Indian registration plate, e.g. MH12AB1234 or DL1CAB1234. */
export function checkIndianPlate(raw: string): string | null {
  const v = raw.toUpperCase().replace(/[\s-]/g, "");
  if (!v) return "Enter the plate number.";
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(v)) return "Check the plate number (e.g. MH12AB1234).";
  return null;
}

function parseDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Riders must be at least 18. */
export function checkAdult(dob: string, now = new Date()): string | null {
  const d = parseDate(dob);
  if (!d) return "Enter your date of birth.";
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  if (d > cutoff) return "You must be at least 18 years old.";
  if (d.getUTCFullYear() < 1940) return "Check the date of birth.";
  return null;
}

/** An expiry date must be today or later. */
export function checkNotExpired(date: string, what: string, now = new Date()): string | null {
  const d = parseDate(date);
  if (!d) return `Enter the ${what} expiry date.`;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (d < today) return `The ${what} has expired.`;
  return null;
}

/** Plate: letters and digits, spaces/dashes allowed, 3-10 characters. */
export function checkPlate(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "");
  if (!v) return "Enter the plate number.";
  if (!/^[\p{L}\d]{3,10}$/u.test(v)) return "Check the plate number.";
  return null;
}

/** Bicycle riders have no plate, registration or insurance to show. */
export function needsVehicleDocs(vehicleType: string): boolean {
  return vehicleType !== "bicycle";
}
