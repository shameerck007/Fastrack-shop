/** Turns Arabic-Indic digits into ASCII and drops everything that isn't a digit. */
export function digitsOnly(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

export interface IdCheck {
  ok: boolean;
  error: string | null;
  value: string;
}

/** Commercial Registration number: 10 digits issued by the Ministry of Commerce. */
export function checkCrNumber(raw: string): IdCheck {
  const value = digitsOnly(raw);
  if (!value) return { ok: false, error: "Enter the CR number.", value };
  if (value.length !== 10) return { ok: false, error: "A CR number has exactly 10 digits.", value };
  if (value.startsWith("0")) return { ok: false, error: "A CR number doesn't start with 0.", value };
  return { ok: true, error: null, value };
}

/** VAT registration number (ZATCA): 15 digits, starting and ending with 3. Optional. */
export function checkVatNumber(raw: string): IdCheck {
  const value = digitsOnly(raw);
  if (!value) return { ok: true, error: null, value };
  if (value.length !== 15) return { ok: false, error: "A VAT number has exactly 15 digits.", value };
  if (!value.startsWith("3") || !value.endsWith("3")) {
    return { ok: false, error: "A Saudi VAT number starts and ends with 3.", value };
  }
  return { ok: true, error: null, value };
}
