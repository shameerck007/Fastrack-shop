"use client";

import { useRef, useState } from "react";
import { errorText, unwrapAction } from "@/lib/errors";
import { importProductRows } from "@/lib/actions/supplier-integrations";
import { downloadProductTemplate, parseProductFile } from "@/lib/product-template";
import type { SyncResult } from "@/lib/supplier-sync";

const BATCH = 50;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}

export default function ProductImport() {
  const input = useRef<HTMLInputElement>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<{ result: SyncResult; excelRow: number }[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNote(null);
    setResults(null);
    if (file.size > 5 * 1024 * 1024) return setError("The file is over 5 MB. Split it into smaller files.");
    setBusy(true);
    try {
      setProgress("Reading your file…");
      const parsed = await parseProductFile(file);
      if (parsed.rows.length === 0) throw new Error("There are no product rows to upload." + (parsed.skippedExamples ? " The example rows were skipped." : ""));
      if (parsed.rows.length > 2000) throw new Error("At most 2000 rows per file.");
      if (parsed.skippedExamples) setNote(`${parsed.skippedExamples} example row${parsed.skippedExamples === 1 ? "" : "s"} skipped.`);
      const all: { result: SyncResult; excelRow: number }[] = [];
      for (let i = 0; i < parsed.rows.length; i += BATCH) {
        setProgress(`Saving rows ${i + 1} to ${Math.min(i + BATCH, parsed.rows.length)} of ${parsed.rows.length}…`);
        const part = await unwrapAction(importProductRows)(parsed.rows.slice(i, i + BATCH), createMissing);
        for (const r of part) all.push({ result: r, excelRow: parsed.excelRows[i + r.index] });
      }
      setResults(all);
    } catch (e) {
      setError(errorText(e, "The upload stopped. Rows saved before this point are kept."));
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  const count = (s: SyncResult["status"]) => results?.filter((r) => r.result.status === s).length ?? 0;
  const problems = results?.filter((r) => r.result.status === "error") ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-neutral-900">Add or update many products with Excel</h2>
      <p className="mt-1 text-sm text-neutral-500">One row per pack size. A sku FasTrack already has is updated; a new sku is created.</p>

      <ol className="mt-5 flex flex-col gap-5">
        <Step n={1} title="Download the Excel template">
          <button onClick={downloadProductTemplate} className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
            <span aria-hidden>📥</span> Download template (.xlsx)
          </button>
          <p className="mt-2 text-xs text-neutral-500">It has a Products sheet to fill in and a Guide sheet that explains every column.</p>
        </Step>

        <Step n={2} title="Fill it in and save it as .xlsx">
          <p className="text-sm text-neutral-600">
            Required for a new product: <b>sku</b>, <b>name</b>, <b>category</b>, <b>price</b> and <b>stock</b>. Delete the two EXAMPLE rows or leave them, they are skipped.
          </p>
        </Step>

        <Step n={3} title="Upload your file">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!busy) onFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${over ? "border-blue-500 bg-blue-50" : "border-neutral-300 bg-neutral-50"}`}
          >
            <span className="text-3xl" aria-hidden>📄</span>
            <p className="text-sm text-neutral-600">{busy ? progress || "Working…" : "Drop your Excel file here, or"}</p>
            <button
              onClick={() => input.current?.click()}
              disabled={busy}
              className="h-11 rounded-full bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Choose Excel file"}
            </button>
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="h-4 w-4 accent-blue-700" />
            Create products that do not exist yet (untick to only update existing ones)
          </label>
        </Step>
      </ol>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {results && (
        <div className="mt-5 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm font-semibold text-neutral-900">Result</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Created", count("created"), "text-emerald-700 bg-emerald-50"],
              ["Updated", count("updated"), "text-blue-700 bg-blue-50"],
              ["Unchanged", count("unchanged"), "text-neutral-600 bg-neutral-100"],
              ["Problems", problems.length, problems.length ? "text-red-700 bg-red-50" : "text-neutral-600 bg-neutral-100"],
            ].map(([label, n, cls]) => (
              <div key={label as string} className={`rounded-xl px-3 py-2 ${cls}`}>
                <p className="text-xl font-bold leading-tight">{n as number}</p>
                <p className="text-xs">{label as string}</p>
              </div>
            ))}
          </div>
          {note && <p className="mt-2 text-xs text-neutral-500">{note}</p>}
          {problems.length > 0 && (
            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-red-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-red-50 text-left text-red-900">
                  <tr>
                    <th className="px-3 py-2">Excel row</th>
                    <th className="px-3 py-2">sku</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={p.excelRow} className="border-t border-red-100">
                      <td className="px-3 py-1.5">{p.excelRow}</td>
                      <td className="px-3 py-1.5 font-mono">{p.result.sku}</td>
                      <td className="px-3 py-1.5">{p.result.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {problems.length > 0 && <p className="mt-2 text-xs text-neutral-500">Fix those rows and upload again. Rows that already saved are simply updated.</p>}
        </div>
      )}
    </div>
  );
}
