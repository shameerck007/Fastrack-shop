import { checkSaudiIban } from "@/lib/iban";

// Bank codes are the 2 digits at positions 5-6 of a Saudi IBAN, assigned by
// SAMA. The 11 local banks and their codes were checked against two sources
// (a SAMA code table and the list of licensed banks). Legacy codes of merged
// banks are kept because older IBANs can still carry them: Samba (40) merged
// into SNB, Alawwal (50) merged into SAB.
// Digital banks and "Other" have no code check — only the shape and checksum.

export interface SaudiBank {
  /** Value stored in stores.bank_name. */
  name: string;
  nameAr: string;
  /** IBAN bank codes that belong to this bank; empty = don't match the code. */
  codes: string[];
}

export const SAUDI_BANKS: SaudiBank[] = [
  { name: "Al Rajhi Bank", nameAr: "مصرف الراجحي", codes: ["80"] },
  { name: "Saudi National Bank (SNB)", nameAr: "البنك الأهلي السعودي", codes: ["10", "40"] },
  { name: "Riyad Bank", nameAr: "بنك الرياض", codes: ["20"] },
  { name: "Saudi Awwal Bank (SAB)", nameAr: "البنك السعودي الأول", codes: ["45", "50"] },
  { name: "Arab National Bank (ANB)", nameAr: "البنك العربي الوطني", codes: ["30"] },
  { name: "Alinma Bank", nameAr: "مصرف الإنماء", codes: ["05"] },
  { name: "Banque Saudi Fransi (BSF)", nameAr: "البنك السعودي الفرنسي", codes: ["55"] },
  { name: "Bank Albilad", nameAr: "بنك البلاد", codes: ["15"] },
  { name: "Bank Aljazira", nameAr: "بنك الجزيرة", codes: ["60"] },
  { name: "Saudi Investment Bank (SAIB)", nameAr: "البنك السعودي للاستثمار", codes: ["65"] },
  { name: "Gulf International Bank (GIB)", nameAr: "بنك الخليج الدولي", codes: ["90"] },
  { name: "STC Bank", nameAr: "بنك STC", codes: [] },
  { name: "D360 Bank", nameAr: "بنك D360", codes: [] },
  { name: "Vision Bank", nameAr: "بنك فيجن", codes: [] },
];

export const OTHER_BANK = "Other bank";

export function findBank(name: string | null | undefined): SaudiBank | undefined {
  return SAUDI_BANKS.find((b) => b.name === name);
}

/** Which listed bank an IBAN's code points to, for showing "Looks like Al Rajhi Bank". */
export function bankForCode(code: string | null): SaudiBank | undefined {
  return code ? SAUDI_BANKS.find((b) => b.codes.includes(code)) : undefined;
}

export interface BankDetailsCheck {
  ok: boolean;
  /** Shopper-readable reason when not ok. */
  error: string | null;
  iban: string;
}

/** The full rule used both live in the form and again on the server. */
export function checkBankDetails(bankName: string, ibanRaw: string): BankDetailsCheck {
  const iban = checkSaudiIban(ibanRaw);
  if (!bankName) return { ok: false, error: "Choose the bank.", iban: iban.iban };
  if (!iban.ok) return { ok: false, error: null, iban: iban.iban };

  const bank = findBank(bankName);
  if (bank && bank.codes.length > 0 && iban.bankCode && !bank.codes.includes(iban.bankCode)) {
    const actual = bankForCode(iban.bankCode);
    return {
      ok: false,
      error: actual
        ? `This IBAN belongs to ${actual.name}, not ${bank.name}. Choose the right bank or check the IBAN.`
        : `This IBAN's bank code (${iban.bankCode}) doesn't match ${bank.name}. Choose the right bank or check the IBAN.`,
      iban: iban.iban,
    };
  }
  return { ok: true, error: null, iban: iban.iban };
}
