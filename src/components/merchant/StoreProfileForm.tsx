"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStoreProfile } from "@/lib/actions/merchant";
import { adminUpdateStoreProfile } from "@/lib/actions/admin-merchants";
import StoreProfileFields, { type StoreProfileValue } from "@/components/merchant/StoreProfileFields";
import FormDialog from "@/components/ui/FormDialog";
import { DAY_KEYS, DAY_NAMES, formatClock, shiftsOf, type OpeningHours } from "@/lib/store-hours";

interface Saved {
  profile: StoreProfileValue;
  accepting: boolean;
}

/** One line per open day, for the summary card (for example "Sun–Thu 08:00–22:00"). */
function hoursSummary(hours: OpeningHours): string {
  if (!hours) return "Not set";
  const open = DAY_KEYS.filter((k) => shiftsOf(hours[k]).length > 0);
  if (open.length === 0) return "Closed every day";
  const first = hours[open[0]];
  const sameAll = open.every((k) => JSON.stringify(shiftsOf(hours[k])) === JSON.stringify(shiftsOf(first)));
  const range = (k: string) => shiftsOf(hours[k]).map((s) => `${formatClock(s.open, "en")}–${formatClock(s.close, "en")}`).join(", ");
  if (open.length === 7 && sameAll) return `Every day ${range(open[0])}`;
  if (sameAll) return `${open.length} days a week, ${range(open[0])}`;
  return `${open.length} days a week (${open.map((k) => DAY_NAMES[Number(k)].slice(0, 3)).join(", ")})`;
}

/** The shop page: logo, cover, tagline and opening hours. Shows what is set now; Edit opens a popup. */
export default function StoreProfileForm({
  initial,
  storeId,
}: {
  /** Set when an admin is editing a shop on its behalf. */
  storeId?: string;
  initial: {
    logoUrl: string | null;
    coverUrl: string | null;
    tagline: string | null;
    hours: OpeningHours;
    acceptingOrders: boolean;
  };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved>({
    profile: { logoUrl: initial.logoUrl, coverUrl: initial.coverUrl, tagline: initial.tagline ?? "", hours: initial.hours },
    accepting: initial.acceptingOrders,
  });
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<StoreProfileValue>(saved.profile);
  const [accepting, setAccepting] = useState(saved.accepting);

  async function save(): Promise<string | void> {
    const payload = {
      logoUrl: profile.logoUrl,
      coverUrl: profile.coverUrl,
      tagline: profile.tagline,
      openingHours: profile.hours,
      acceptingOrders: accepting,
    };
    if (storeId) await adminUpdateStoreProfile({ storeId, ...payload });
    else await updateStoreProfile(payload);
    setSaved({ profile, accepting });
    router.refresh();
  }

  const p = saved.profile;
  return (
    <>
      <section className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${storeId ? "" : "mt-6"}`}>
        <div className="relative h-24 bg-gradient-to-r from-blue-100 via-indigo-50 to-sky-100">
          {p.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
          <div className="-mt-12 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow ring-1 ring-neutral-200">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl">🏪</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">Shop page &amp; opening hours</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${saved.accepting ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{saved.accepting ? "Accepting orders" : "Paused"}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">Your logo and hours appear on your shop page and next to your products.</p>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-neutral-500">Tagline</dt>
                <dd className={`min-w-0 truncate font-semibold ${p.tagline ? "text-neutral-900" : "font-normal text-neutral-300"}`}>{p.tagline || "Not set"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-neutral-500">Hours</dt>
                <dd className="min-w-0 truncate font-semibold text-neutral-900">{hoursSummary(p.hours)}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => {
              setProfile(saved.profile);
              setAccepting(saved.accepting);
              setOpen(true);
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
          >
            <span aria-hidden>✎</span> Edit
          </button>
        </div>
      </section>

      {open && (
        <FormDialog icon="🏪" title="Shop page & opening hours" subtitle="Logo, cover photo, tagline and weekly hours" size="xl" onClose={() => setOpen(false)} onSave={save}>
          <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm shadow-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-700" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
            <span>
              <span className="font-bold text-neutral-900">Accepting orders</span>
              <span className="block text-xs text-neutral-500">Turn off to pause orders right now (for example when you are too busy). Customers see the shop as closed.</span>
            </span>
          </label>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <StoreProfileFields value={profile} onChange={setProfile} />
          </div>
        </FormDialog>
      )}
    </>
  );
}
