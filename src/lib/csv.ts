/** Small CSV reader: quoted fields, doubled quotes, commas or semicolons (Excel in some regions), CRLF. Returns objects keyed by the header row. */
export function parseCsv(input: string): { rows: Record<string, string>[]; headers: string[] } {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) table.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) table.push(row);
  const headers = (table.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = table.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { rows, headers };
}

export const CSV_TEMPLATE_HEADERS = ["sku", "name", "name_ar", "brand", "category", "description", "image_url", "tax_rate", "active", "variant_label", "unit", "quantity", "price", "compare_at_price", "compare_at_until", "stock"];
export const CSV_TEMPLATE = `${CSV_TEMPLATE_HEADERS.join(",")}\nRICE-5KG,Basmati Rice,,Royal,Grocery,Long grain basmati,,15,yes,5 kg,kg,5,45.00,52.00,2026-12-31,120\nRICE-5KG,,,,,,,,,1 kg,kg,1,10.00,,,300\n`;
