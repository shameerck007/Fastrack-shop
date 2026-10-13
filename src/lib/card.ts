/**
 * Card checks that run as the shopper types, and again on the server before anything is sent to the payment provider.
 * Pure functions with no imports, so the browser and the server use exactly the same rules.
 * The checks catch typing mistakes early (wrong digit, expired card, wrong code length); the bank still has the last word.
 */

export type CardBrand = "mada" | "visa" | "mastercard" | "amex" | "unionpay" | "unknown";

/** The first digits of mada cards (Saudi national scheme). Used only to show the right logo and name; the bank decides the rest. */
const MADA_PREFIXES = [
  "407197", "407395", "409201", "410621", "417633", "420132", "431361", "434107", "440647", "440795", "443345", "446393", "446404", "455036", "455708", "457865", "457997", "462220",
  "468540", "468541", "468542", "468543", "474491", "483010", "483011", "483012", "484783", "486094", "486095", "486096", "489317", "489318", "489319", "493428", "504300", "506968", "508160", "521076", "524130", "529415", "529741", "530060",
  "531196", "535825", "535989", "536023", "537767", "539931", "543357", "549760", "554180", "557606", "558563", "585265", "588845", "588846", "588847", "588848", "588849", "588850", "589206", "604906", "605141", "636120", "968201", "968202",
  "968203", "968204", "968205", "968206", "968207", "968208", "968209", "968210", "968211", "22402030", "242030",
];

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function detectBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (MADA_PREFIXES.some((p) => n.startsWith(p))) return "mada";
  if (/^3[47]/.test(n)) return "amex";
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]\d|7[01]|720))/.test(n)) return "mastercard";
  if (/^62/.test(n)) return "unionpay";
  return "unknown";
}

export const BRAND_NAME: Record<CardBrand, string> = { mada: "mada", visa: "Visa", mastercard: "Mastercard", amex: "American Express", unionpay: "UnionPay", unknown: "Card" };

/** The card numbers each brand uses: amex 15, the rest 16 (unionpay and unknown may be 16 to 19). */
function lengthsFor(brand: CardBrand): number[] {
  if (brand === "amex") return [15];
  if (brand === "unionpay" || brand === "unknown") return [16, 17, 18, 19];
  return [16];
}

export const cvcLength = (brand: CardBrand) => (brand === "amex" ? 4 : 3);

/** The standard check-digit test every real card number passes (Luhn). Catches almost every mistyped digit. */
export function luhnValid(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 12) return false;
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = n.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** "4111111111111111" becomes "4111 1111 1111 1111" (amex: 4-6-5). */
export function formatCardNumber(input: string): string {
  const n = digitsOnly(input).slice(0, 19);
  if (/^3[47]/.test(n)) return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  return n.replace(/(.{4})/g, "$1 ").trim();
}

/** Typing "1226" shows "12/26"; a first digit above 1 becomes "0" + digit so the month is always valid. */
export function formatExpiry(input: string, previous = ""): string {
  let d = digitsOnly(input).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  if (d.length >= 2 && Number(d.slice(0, 2)) === 0) d = "0";
  if (d.length >= 2 && Number(d.slice(0, 2)) > 12) d = d.slice(0, 1);
  // Backspacing over the slash removes the digit before it.
  if (previous.length > input.length && previous.endsWith("/") && d.length === 2) return d.slice(0, 1);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d.length === 2 && input.length >= 2 && previous.length < input.length ? `${d}/` : d;
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2}|\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/** A card is good through the last day of its expiry month. Also refuses dates implausibly far ahead (more than 20 years). */
export function expiryProblem(value: string, now = new Date()): string | null {
  if (!value.trim()) return "Enter the expiry date.";
  const e = parseExpiry(value);
  if (!e) return "Enter the expiry as MM/YY.";
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  if (e.year < thisYear || (e.year === thisYear && e.month < thisMonth)) return "This card has expired.";
  if (e.year > thisYear + 20) return "Check the expiry year.";
  return null;
}

export function numberProblem(number: string): string | null {
  const n = digitsOnly(number);
  if (!n) return "Enter the card number.";
  if (/^(\d)\1+$/.test(n)) return "Check the card number.";
  const brand = detectBrand(n);
  if (!lengthsFor(brand).includes(n.length)) return n.length < Math.min(...lengthsFor(brand)) ? "The card number is too short." : "The card number is too long.";
  if (!luhnValid(n)) return "This card number is not valid. Check each digit.";
  return null;
}

export function cvcProblem(cvc: string, brand: CardBrand): string | null {
  const d = digitsOnly(cvc);
  if (!d) return "Enter the security code.";
  if (d.length !== cvcLength(brand)) return `The security code is ${cvcLength(brand)} digits${brand === "amex" ? " (on the front of the card)" : " (on the back)"}.`;
  return null;
}

/** The name on the card: at least two words, letters only (the payment provider needs it in English letters). */
export function nameProblem(name: string): string | null {
  const t = name.trim().replace(/\s+/g, " ");
  if (!t) return "Enter the name on the card.";
  if (!/^[A-Za-z][A-Za-z.'-]*(?: [A-Za-z][A-Za-z.'-]*)+$/.test(t)) return "Enter the first and last name in English letters, as printed on the card.";
  if (t.length > 60) return "That name is too long.";
  return null;
}

export interface CardInput {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}

export interface CardErrors {
  name?: string;
  number?: string;
  expiry?: string;
  cvc?: string;
}

export function validateCard(c: CardInput, now = new Date()): CardErrors {
  const brand = detectBrand(c.number);
  const errors: CardErrors = {};
  const name = nameProblem(c.name);
  const number = numberProblem(c.number);
  const expiry = expiryProblem(c.expiry, now);
  const cvc = cvcProblem(c.cvc, brand);
  if (name) errors.name = name;
  if (number) errors.number = number;
  if (expiry) errors.expiry = expiry;
  if (cvc) errors.cvc = cvc;
  return errors;
}

export const hasErrors = (e: CardErrors) => Object.keys(e).length > 0;

/** Which payments-table method a brand is recorded as. */
export function paymentMethodFor(brand: CardBrand): "mada" | "visa" | "mastercard" {
  return brand === "mada" ? "mada" : brand === "mastercard" ? "mastercard" : "visa";
}
