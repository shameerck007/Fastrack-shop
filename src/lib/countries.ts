export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // E.164 calling code, with leading +
  flag: string;
}

// GCC first (primary market), then other commonly-needed countries —
// not the full ISO-3166 list, but covers the overwhelming majority of
// real signups without an unwieldy 200+ option dropdown.
export const COUNTRIES: Country[] = [
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "JO", name: "Jordan", dial: "+962", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "IQ", name: "Iraq", dial: "+964", flag: "🇮🇶" },
  { code: "YE", name: "Yemen", dial: "+967", flag: "🇾🇪" },
  { code: "SY", name: "Syria", dial: "+963", flag: "🇸🇾" },
  { code: "PS", name: "Palestine", dial: "+970", flag: "🇵🇸" },
  { code: "SD", name: "Sudan", dial: "+249", flag: "🇸🇩" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Algeria", dial: "+213", flag: "🇩🇿" },
  { code: "TN", name: "Tunisia", dial: "+216", flag: "🇹🇳" },
  { code: "LY", name: "Libya", dial: "+218", flag: "🇱🇾" },
  { code: "TR", name: "Turkey", dial: "+90", flag: "🇹🇷" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
];

export const DEFAULT_COUNTRY_CODE = "SA";

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

/** Checks a stored E.164 number ("+966501234567"). Saudi numbers are held to the
 * exact mobile shape (5 + 8 digits); other countries get the E.164 length range. */
export function validatePhone(value: string): { ok: boolean; error: string | null } {
  if (!value) return { ok: false, error: "Enter a mobile number." };
  if (!/^\+\d{8,15}$/.test(value)) return { ok: false, error: "Enter a valid mobile number." };
  if (value.startsWith("+966") && !/^\+9665\d{8}$/.test(value)) {
    return { ok: false, error: "Saudi mobile numbers have 9 digits and start with 5 (e.g. 5X XXX XXXX)." };
  }
  return { ok: true, error: null };
}
