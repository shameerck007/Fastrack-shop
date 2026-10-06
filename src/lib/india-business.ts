// India supplier tax and bank identifiers: GSTIN (with checksum), PAN, FSSAI, IFSC and account
// numbers. Pure functions shared by the browser and the server.

/** GST state codes (the first two digits of a GSTIN) -> state / UT name. */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

export interface CodeCheck {
  ok: boolean;
  error: string | null;
  value: string;
}

const normalise = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** PAN: 5 letters, 4 digits, 1 letter. */
export function checkPan(raw: string): CodeCheck {
  const value = normalise(raw);
  if (!value) return { ok: false, error: "Enter the PAN.", value };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
    return { ok: false, error: "A PAN is 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).", value };
  }
  return { ok: true, error: null, value };
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The 15th character of a GSTIN is a check character over the first 14 (mod 36). */
function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = GSTIN_CHARS.indexOf(first14[i]);
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

export type GstinCheck = CodeCheck & { stateName: string | null; pan: string | null };

/** GSTIN: state code + PAN + entity number + "Z" + check character. */
export function checkGstin(raw: string): GstinCheck {
  const value = normalise(raw);
  const bad = (error: string): GstinCheck => ({ ok: false, error, value, stateName: null, pan: null });
  if (!value) return bad("Enter the GSTIN.");
  if (value.length !== 15) return bad("A GSTIN has exactly 15 characters.");
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) {
    return bad("This does not look like a GSTIN (e.g. 27ABCDE1234F1Z5).");
  }
  const stateName = GST_STATE_CODES[value.slice(0, 2)];
  if (!stateName) return bad("The first two digits of a GSTIN must be a valid state code.");
  if (gstinCheckChar(value.slice(0, 14)) !== value[14]) {
    return bad("This GSTIN is not valid: one of the characters is wrong. Please check it against the registration certificate.");
  }
  return { ok: true, error: null, value, stateName, pan: value.slice(2, 12) };
}

/** FSSAI food licence / registration number: 14 digits. */
export function checkFssai(raw: string): CodeCheck {
  const value = raw.replace(/\D/g, "");
  if (!value) return { ok: false, error: "Enter the FSSAI number.", value };
  if (value.length !== 14) return { ok: false, error: "An FSSAI number has exactly 14 digits.", value };
  return { ok: true, error: null, value };
}

/** IFSC: 4 letters (bank), a zero, then 6 letters/digits (branch). */
export function checkIfsc(raw: string): CodeCheck {
  const value = normalise(raw);
  if (!value) return { ok: false, error: "Enter the IFSC.", value };
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) {
    return { ok: false, error: "An IFSC is 11 characters: 4 letters, a zero, then 6 letters or digits (e.g. HDFC0001234).", value };
  }
  return { ok: true, error: null, value };
}

export function checkBankAccountNumber(raw: string): CodeCheck {
  const value = raw.replace(/\D/g, "");
  if (!value) return { ok: false, error: "Enter the account number.", value };
  if (value.length < 9 || value.length > 18) return { ok: false, error: "An account number has 9 to 18 digits.", value };
  return { ok: true, error: null, value };
}

export interface IndianBank {
  name: string;
  /** First four letters of the bank's IFSC codes. */
  ifscPrefixes: string[];
}

export const INDIAN_BANKS: IndianBank[] = [
  { name: "State Bank of India", ifscPrefixes: ["SBIN"] },
  { name: "HDFC Bank", ifscPrefixes: ["HDFC"] },
  { name: "ICICI Bank", ifscPrefixes: ["ICIC"] },
  { name: "Axis Bank", ifscPrefixes: ["UTIB"] },
  { name: "Kotak Mahindra Bank", ifscPrefixes: ["KKBK"] },
  { name: "Punjab National Bank", ifscPrefixes: ["PUNB"] },
  { name: "Bank of Baroda", ifscPrefixes: ["BARB"] },
  { name: "Canara Bank", ifscPrefixes: ["CNRB"] },
  { name: "Union Bank of India", ifscPrefixes: ["UBIN"] },
  { name: "Indian Bank", ifscPrefixes: ["IDIB"] },
  { name: "Bank of India", ifscPrefixes: ["BKID"] },
  { name: "Central Bank of India", ifscPrefixes: ["CBIN"] },
  { name: "IDFC FIRST Bank", ifscPrefixes: ["IDFB"] },
  { name: "Yes Bank", ifscPrefixes: ["YESB"] },
  { name: "IndusInd Bank", ifscPrefixes: ["INDB"] },
  { name: "Federal Bank", ifscPrefixes: ["FDRL"] },
  { name: "Bank of Maharashtra", ifscPrefixes: ["MAHB"] },
  { name: "Indian Overseas Bank", ifscPrefixes: ["IOBA"] },
  { name: "UCO Bank", ifscPrefixes: ["UCBA"] },
  { name: "South Indian Bank", ifscPrefixes: ["SIBL"] },
  { name: "Karnataka Bank", ifscPrefixes: ["KARB"] },
  { name: "RBL Bank", ifscPrefixes: ["RATN"] },
  { name: "Bandhan Bank", ifscPrefixes: ["BDBL"] },
  { name: "AU Small Finance Bank", ifscPrefixes: ["AUBL"] },
  { name: "Paytm Payments Bank", ifscPrefixes: ["PYTM"] },
];

export const OTHER_INDIAN_BANK = "Other bank";

export function findIndianBank(name: string | null | undefined): IndianBank | undefined {
  return INDIAN_BANKS.find((b) => b.name === name);
}

/** The full bank-details rule used in the form and again on the server. */
export function checkIndianBankDetails(input: { bankName: string; accountNumber: string; ifsc: string; holder: string }): {
  ok: boolean;
  error: string | null;
  accountNumber: string;
  ifsc: string;
} {
  const account = checkBankAccountNumber(input.accountNumber);
  const ifsc = checkIfsc(input.ifsc);
  const fail = (error: string | null) => ({ ok: false, error, accountNumber: account.value, ifsc: ifsc.value });
  if (!input.bankName.trim()) return fail("Choose the bank.");
  if (!input.holder.trim()) return fail("Enter the account holder name (as on the bank account).");
  if (!account.ok) return fail(account.error);
  if (!ifsc.ok) return fail(ifsc.error);
  const bank = findIndianBank(input.bankName);
  if (bank && !bank.ifscPrefixes.includes(ifsc.value.slice(0, 4))) {
    return fail(`This IFSC (${ifsc.value.slice(0, 4)}...) does not belong to ${bank.name}. Choose the right bank or check the IFSC.`);
  }
  return { ok: true, error: null, accountNumber: account.value, ifsc: ifsc.value };
}

export interface IndiaSupplierValue {
  gstin: string;
  pan: string;
  fssai: string;
  state: string;
  city: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
}

export const EMPTY_INDIA_SUPPLIER: IndiaSupplierValue = {
  gstin: "",
  pan: "",
  fssai: "",
  state: "",
  city: "",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  ifsc: "",
};

/** The one place every India supplier rule is combined; used on submit and by the server action. */
export function validateIndiaSupplier(v: IndiaSupplierValue): string | null {
  const gstin = checkGstin(v.gstin);
  if (!gstin.ok) return gstin.error;
  const pan = checkPan(v.pan);
  if (!pan.ok) return pan.error;
  if (gstin.pan !== pan.value) return "The PAN doesn't match the PAN inside the GSTIN. Check both numbers.";
  if (v.fssai.trim()) {
    const f = checkFssai(v.fssai);
    if (!f.ok) return f.error;
  }
  if (!v.state) return "Choose the state.";
  if (gstin.stateName && gstin.stateName !== v.state) {
    return `The GSTIN is registered in ${gstin.stateName}, but you chose ${v.state}. Pick the state on your GST certificate.`;
  }
  if (!v.city.trim()) return "Enter the town or city.";
  const bank = checkIndianBankDetails({ bankName: v.bankName, accountNumber: v.accountNumber, ifsc: v.ifsc, holder: v.accountHolder });
  if (!bank.ok) return bank.error;
  return null;
}

