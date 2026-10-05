// Saudi IBAN: "SA" + 2 check digits + 2-digit SAMA bank code + 18-digit
// account number = 24 characters. Payouts go to these numbers, so the checks
// are strict: exact shape, the ISO 13616 mod-97 checksum, and (when a bank
// has been chosen) that the bank code inside the IBAN belongs to that bank.

export const SAUDI_IBAN_LENGTH = 24;

/** Uppercase with spaces/dashes removed — the form we store. */
export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** "SA03 8000 0000 6080 1016 7519" for display. */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})/g, "$1 ").trim();
}

// mod 97 over the rearranged IBAN, digit by digit so it never needs BigInt.
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch; // A=10 ... Z=35
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export type IbanProblem =
  | "empty"
  | "not_saudi"
  | "bad_length"
  | "bad_characters"
  | "bad_checksum";

export interface IbanCheck {
  ok: boolean;
  problem: IbanProblem | null;
  iban: string;
  /** The 2-digit SAMA bank code inside the IBAN, when the shape is right. */
  bankCode: string | null;
}

export function checkSaudiIban(raw: string): IbanCheck {
  const iban = normalizeIban(raw);
  const fail = (problem: IbanProblem): IbanCheck => ({ ok: false, problem, iban, bankCode: null });

  if (!iban) return fail("empty");
  if (!iban.startsWith("SA")) return fail("not_saudi");
  if (!/^[A-Z0-9]*$/.test(iban)) return fail("bad_characters");
  if (iban.length !== SAUDI_IBAN_LENGTH) return fail("bad_length");
  if (!/^SA\d{22}$/.test(iban)) return fail("bad_characters");
  if (mod97(iban) !== 1) return fail("bad_checksum");

  return { ok: true, problem: null, iban, bankCode: iban.slice(4, 6) };
}

export const IBAN_PROBLEM_MESSAGES: Record<IbanProblem, string> = {
  empty: "Enter the IBAN.",
  not_saudi: "A Saudi IBAN starts with SA.",
  bad_length: "A Saudi IBAN has exactly 24 characters (SA followed by 22 digits).",
  bad_characters: "After SA, a Saudi IBAN contains digits only.",
  bad_checksum: "This IBAN isn't valid — one of the digits is wrong. Please check it against the bank letter.",
};
