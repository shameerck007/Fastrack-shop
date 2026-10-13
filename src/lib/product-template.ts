import { buildXlsx, excelSerialToDate, readXlsx } from "@/lib/xlsx-lite";

/** The columns of the product sheet. The header row of the template uses the key names, so a file can be matched column by column. */
export const PRODUCT_COLUMNS: { key: string; required: string; what: string; example: string; width: number }[] = [
  { key: "sku", required: "sku or barcode", what: "Your own product code. Rows with the same sku are the packs of one product.", example: "EXAMPLE-RICE", width: 16 },
  { key: "barcode", required: "sku or barcode", what: "The EAN or UPC barcode (8 to 14 digits). If FasTrack's catalog has it, you sell that catalog product and only price and stock are yours to set. Format the column as Text.", example: "", width: 16 },
  { key: "name", required: "New products not in the catalog", what: "Product name.", example: "Basmati Rice", width: 28 },
  { key: "name_ar", required: "No", what: "Arabic name.", example: "", width: 22 },
  { key: "brand", required: "No", what: "Brand.", example: "Royal", width: 16 },
  { key: "category", required: "New products", what: "A category name or slug from the shop, for example Grocery or grocery.", example: "grocery", width: 16 },
  { key: "description", required: "No", what: "A short description.", example: "Long grain basmati rice", width: 30 },
  { key: "image_url", required: "No", what: "A link to the photo, starting with https://", example: "", width: 28 },
  { key: "tax_rate", required: "No", what: "Tax percent, for example 15.", example: "15", width: 10 },
  { key: "active", required: "No", what: "yes to show the product, no to hide it.", example: "yes", width: 10 },
  { key: "variant_label", required: "New packs", what: "The pack, for example 1 kg or 500 g. Default: 1 unit. It identifies the pack inside the sku.", example: "5 kg", width: 14 },
  { key: "unit", required: "No", what: "kg, g, l, ml or unit.", example: "kg", width: 8 },
  { key: "quantity", required: "No", what: "How many units are in the pack.", example: "5", width: 10 },
  { key: "price", required: "New packs", what: "Selling price, above 0.", example: "45", width: 10 },
  { key: "compare_at_price", required: "No", what: "The old price shown crossed out. Must be higher than price.", example: "52", width: 16 },
  { key: "compare_at_until", required: "No", what: "Last day of the offer, for example 2026-12-31 or an Excel date.", example: "2026-12-31", width: 16 },
  { key: "stock", required: "New packs", what: "Units in stock, 0 or more.", example: "120", width: 10 },
];

/** The downloadable Excel template: a Products sheet to fill in, and a Guide sheet that explains every column. */
export function buildProductTemplate(): Uint8Array {
  const keys = PRODUCT_COLUMNS.map((c) => c.key);
  const example1 = PRODUCT_COLUMNS.map((c) => (/^\d+(\.\d+)?$/.test(c.example) ? Number(c.example) : c.example));
  const example2 = keys.map((k) => ({ sku: "EXAMPLE-RICE", variant_label: "1 kg", unit: "kg", quantity: 1, price: 10, stock: 300 })[k as "sku"] ?? "");
  return buildXlsx([
    { name: "Products", rows: [keys, example1, example2], widths: PRODUCT_COLUMNS.map((c) => c.width), exampleRows: 2 },
    {
      name: "Guide",
      rows: [
        ["Column", "Needed", "What to enter"],
        ...PRODUCT_COLUMNS.map((c) => [c.key, c.required, c.what] as (string | number | null)[]),
        [null, null, null],
        ["How it works", null, "One row per pack size. Rows with the same sku are the packs of one product. A sku FasTrack already has is updated; a new sku is created."],
        [null, null, "Delete the two EXAMPLE rows (rows with a sku that starts with EXAMPLE are skipped anyway). Keep the first row as it is."],
        [null, null, "Blank cells are left as they are: to change only the stock of a product, fill in sku, variant_label and stock."],
      ],
      widths: [20, 16, 90],
      wrap: true,
    },
  ]);
}

export function downloadProductTemplate() {
  const blob = new Blob([buildProductTemplate() as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fastrack-products-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedSheet {
  rows: Record<string, string>[];
  /** Row number in Excel for each parsed row (1 = the header). */
  excelRows: number[];
  skippedExamples: number;
}

/** Reads an uploaded .xlsx into rows keyed by the header names. */
export async function parseProductFile(file: File): Promise<ParsedSheet> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Please upload an Excel file saved as .xlsx (use the template). Older .xls and CSV files are not accepted.");
  const sheet = await readXlsx(await file.arrayBuffer(), "Products");
  const headerAt = sheet.rows.findIndex((r) => r && r.some((c) => c));
  if (headerAt < 0) throw new Error("The sheet is empty.");
  const headers = sheet.rows[headerAt].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  if (!headers.includes("sku")) throw new Error('The first row must have a column called "sku". Download the template to see the columns.');
  const rows: Record<string, string>[] = [];
  const excelRows: number[] = [];
  let skippedExamples = 0;
  for (let i = headerAt + 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i] ?? [];
    if (!r.some((c) => c)) continue;
    const obj = Object.fromEntries(headers.map((h, c) => [h, (r[c] ?? "").trim()]).filter(([h]) => h));
    if (/^example/i.test(obj.sku ?? "")) {
      skippedExamples++;
      continue;
    }
    // A date typed into Excel arrives as a serial number.
    const until = obj.compare_at_until;
    if (until && /^\d{5}(\.\d+)?$/.test(until)) obj.compare_at_until = excelSerialToDate(Number(until));
    rows.push(obj);
    excelRows.push(i + 1);
  }
  return { rows, excelRows, skippedExamples };
}
