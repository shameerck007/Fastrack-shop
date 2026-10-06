"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTenant, setTenantStatus } from "@/lib/actions/platform";

type Status = "draft" | "active" | "suspended";

/** Open, hide or pause one market. Opening it shows it to customers immediately. */
export function MarketStatusButtons({ tenantId, status, name }: { tenantId: string; status: Status; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: Status) {
    if (next === "active" && !confirm(`Open ${name} to customers now? Its products become visible to everyone in that market.`)) return;
    if (next === "suspended" && !confirm(`Suspend ${name}? Customers will no longer be able to browse or order there.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await setTenantStatus(tenantId, next);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const btn = "rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status !== "active" && (
          <button disabled={pending} onClick={() => change("active")} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
            Open to customers
          </button>
        )}
        {status === "active" && (
          <button disabled={pending} onClick={() => change("draft")} className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
            Hide (draft)
          </button>
        )}
        {status !== "suspended" && (
          <button disabled={pending} onClick={() => change("suspended")} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}>
            Suspend
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Add a new market. It starts as a draft, so nothing is public until you open it. */
export function CreateMarketForm({ countries }: { countries: { code: string; name: string; currency: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState(countries[0]?.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createTenant({ name, slug, countryCode: country });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      setSlug("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
        + Add a market
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Add a market</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }}
            placeholder="FasTrack United Arab Emirates"
            className={field}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Short name</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="fastrack-ae" className={field} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Country (sets the currency)</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${field} bg-white`}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {c.currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-400">The new market starts as a draft. Its tax rules and payment settings still need to be set up before you open it.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="mt-3 rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
        {pending ? "Creating…" : "Create market"}
      </button>
    </form>
  );
}
