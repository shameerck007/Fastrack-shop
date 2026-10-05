import { digitsOnly } from "@/lib/saudi-tax";

export type IdType = "national_id" | "iqama";

/** Saudi national ID starts with 1, Iqama (resident ID) with 2 — both 10 digits. */
export function checkIdNumber(idType: IdType, raw: string): { ok: boolean; error: string | null; value: string } {
  const value = digitsOnly(raw);
  if (!value) return { ok: false, error: "Enter the ID number.", value };
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
