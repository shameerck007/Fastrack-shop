"use client";

import { useState } from "react";
import { errorText, unwrapAction } from "@/lib/errors";
import { importProductRows } from "@/lib/actions/supplier-integrations";
import { CSV_TEMPLATE, parseCsv } from "@/lib/csv";
import type { SyncResult } from "@/lib/supplier-sync";

const BATCH = 50;

export default function ProductImport() {
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "fastrack-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResults(null);
    if (file.size > 5 * 1024 * 1024) return setError("The file is over 5 MB. Split it into smaller files.");
    const { rows, headers } = parseCsv(await file.text());
    if (!headers.includes("sku")) return setError("The first row must have a column called sku. Download the template to see the columns.");
    if (rows.length === 0) return setError("The file has no product rows.");
    if (rows.length > 2000) return setError("At most 2000 rows per file.");
    setBusy(true);
    const all: SyncResult[] = [];
    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        setProgress(`Saving rows ${i + 1} to ${Math.min(i + BATCH, rows.length)} of ${rows.length}…`);
        const part = await unwrapAction(importProductRows)(rows.slice(i, i + BATCH), createMissing);
        for (const r of part) all.push({ ...r, index: r.index + i });
      }
    } catch (e) {
      setError(errorText(e, "The upload stopped. Rows saved before this point are kept."));
    }
    setResults(all);
    setProgress("");
    setBusy(false);
  }

  const count = (s: SyncResult["status"]) => results?.filter((r) => r.status === s).length ?? 0;
  const errors = results?.filter((r) => r.status === "error") ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Upload many products (CSV)</h2>
      <p className="mt-1 text-sm text-neutral-500">
        One row per pack size. Rows with the same <b>sku</b> become the packs of one product. An existing sku is updated; a new one is created. Save from Excel as CSV.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={downloadTemplate} className="h-11 rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
          Download template
        </button>
        <label className={`flex h-11 cursor-pointer items-center rounded-full bg-blue-700 px-6 text-sm font-bold text-white hover:bg-blue-800 ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Uploading…" : "Choose CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="h-4 w-4 accent-blue-700" />
          Create products that do not exist yet
        </label>
      </div>
      {progress && <p className="mt-3 text-sm text-neutral-600">{progress}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-neutral-900">
            {count("created")} created · {count("updated")} updated · {count("unchanged")} unchanged ·{" "}
            <span className={errors.length ? "text-red-600" : ""}>{errors.length} with a problem</span>
          </p>
          {errors.length > 0 && (
            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-red-100 bg-red-50/50">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-red-50 text-left text-red-900">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((r) => (
                    <tr key={r.index} className="border-t border-red-100">
                      <td className="px-3 py-1.5">{r.index + 2}</td>
                      <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                      <td className="px-3 py-1.5">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-500">Row numbers match your file (the header is row 1). Fix those rows and upload again; rows that already saved are simply updated.</p>
        </div>
      )}
    </div>
  );
}
