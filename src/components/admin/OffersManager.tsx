"use client";


import { unwrapAction } from "@/lib/errors";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Select from "@/components/ui/Select";
import ArabicInput from "@/components/ui/ArabicInput";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import { deleteOffer, saveOffer, setOfferActive, type OfferInput } from "@/lib/actions/admin-offers";

export interface OfferRow {
  id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  auto_apply: boolean;
  kind: "percent" | "fixed" | "free_delivery";
  value: number | string;
  max_discount: number | string | null;
  min_order: number | string | null;
  category_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  first_order_only: boolean;
  is_active: boolean;
  funded_by?: "fastrack" | "supplier";
  store_id?: string | null;
  stackable?: boolean;
  show_on_home?: boolean;
  used: number;
  discountGiven: number;
}
export interface StoreOption {
  id: string;
  name: string;
}
interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

type Status = "live" | "scheduled" | "ended" | "off";
const STATUS_LABEL: Record<Status, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", off: "Switched off" };
const STATUS_STYLE: Record<Status, string> = { live: "bg-emerald-50 text-emerald-700", scheduled: "bg-sky-50 text-sky-700", ended: "bg-neutral-100 text-neutral-500", off: "bg-amber-50 text-amber-700" };

function statusOf(o: OfferRow): Status {
  if (!o.is_active) return "off";
  const now = Date.now();
  if (o.starts_at && new Date(o.starts_at).getTime() > now) return "scheduled";
  if ((o.ends_at && new Date(o.ends_at).getTime() < now) || (o.usage_limit != null && o.used >= o.usage_limit)) return "ended";
  return "live";
}

/** An ISO time as the value of a datetime-local box (the viewer's own clock). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

const searchClass = "h-10 w-full rounded-xl border border-neutral-300 bg-white ps-9 pe-3 text-sm placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

interface Draft {
  id?: string;
  name: string;
  nameAr: string;
  kind: OfferInput["kind"];
  auto: boolean;
  code: string;
  value: string;
  maxDiscount: string;
  minOrder: string;
  categoryId: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  isActive: boolean;
  fundedBy: "fastrack" | "supplier";
  storeId: string;
  stackable: boolean;
  showOnHome: boolean;
}
const blank: Draft = { name: "", nameAr: "", kind: "percent", auto: false, code: "", value: "", maxDiscount: "", minOrder: "", categoryId: "", startsAt: "", endsAt: "", usageLimit: "", perCustomerLimit: "", firstOrderOnly: false, isActive: true, fundedBy: "fastrack", storeId: "", stackable: false, showOnHome: true };

const TEMPLATES: { title: string; hint: string; draft: Partial<Draft> }[] = [
  { title: "Welcome offer", hint: "10% off a first order", draft: { name: "Welcome offer", kind: "percent", value: "10", maxDiscount: "30", code: "WELCOME10", firstOrderOnly: true, perCustomerLimit: "1" } },
  { title: "Free delivery on first order", hint: "Automatic, new customers only", draft: { name: "Free delivery on your first order", kind: "free_delivery", auto: true, firstOrderOnly: true, perCustomerLimit: "1", stackable: true } },
  { title: "Free delivery weekend", hint: "Automatic, no code", draft: { name: "Free delivery weekend", kind: "free_delivery", auto: true } },
  { title: "Flat amount off", hint: "Code, with a minimum order", draft: { name: "Save on your basket", kind: "fixed", value: "20", minOrder: "150", code: "SAVE20" } },
  { title: "Category deal", hint: "Percent off one category", draft: { name: "Category deal", kind: "percent", value: "15", auto: true } },
];

function draftOf(o: OfferRow): Draft {
  return {
    id: o.id,
    name: o.name,
    nameAr: o.name_ar ?? "",
    kind: o.kind,
    auto: o.auto_apply,
    code: o.code ?? "",
    value: o.kind === "free_delivery" ? "" : String(Number(o.value)),
    maxDiscount: o.max_discount != null ? String(Number(o.max_discount)) : "",
    minOrder: o.min_order != null ? String(Number(o.min_order)) : "",
    categoryId: o.category_id ?? "",
    startsAt: toLocalInput(o.starts_at),
    endsAt: toLocalInput(o.ends_at),
    usageLimit: o.usage_limit != null ? String(o.usage_limit) : "",
    perCustomerLimit: o.per_customer_limit != null ? String(o.per_customer_limit) : "",
    firstOrderOnly: o.first_order_only,
    isActive: o.is_active,
    fundedBy: o.funded_by ?? "fastrack",
    storeId: o.store_id ?? "",
    stackable: o.stackable ?? false,
    showOnHome: o.show_on_home ?? true,
  };
}

function SearchIcon() {
  return (
    <svg className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="9" r="6" />
      <path d="m14 14 4 4" />
    </svg>
  );
}

export default function OffersManager({ offers, categories, stores, disabled }: { offers: OfferRow[]; categories: CategoryRow[]; stores: StoreOption[]; disabled: boolean }) {
  const router = useRouter();
  const money = useMoney();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const live = offers.filter((o) => statusOf(o) === "live").length;
  const totalUses = offers.reduce((n, o) => n + o.used, 0);
  const given = offers.reduce((n, o) => n + o.discountGiven, 0);

  const needle = q.trim().toLowerCase();
  const list = useMemo(
    () => offers.filter((o) => (filter === "all" || statusOf(o) === filter) && (!needle || `${o.name} ${o.name_ar ?? ""} ${o.code ?? ""}`.toLowerCase().includes(needle))),
    [offers, filter, needle]
  );

  function act(fn: () => Promise<{ error?: string }>, ok: string) {
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: ok });
        router.refresh();
      }
    });
  }

  const benefit = (o: OfferRow) =>
    o.kind === "free_delivery" ? "Free delivery" : o.kind === "percent" ? `${Number(o.value)}% off${o.max_discount != null ? ` (up to ${money(Number(o.max_discount))})` : ""}` : `${money(Number(o.value))} off`;
  const conditions = (o: OfferRow) =>
    [
      o.min_order != null && Number(o.min_order) > 0 ? `Min order ${money(Number(o.min_order))}` : null,
      o.category_id ? `Only ${catName(o.category_id) ?? "one category"}` : null,
      o.store_id ? `Only ${stores.find((x) => x.id === o.store_id)?.name ?? "one supplier"}` : null,
      o.stackable ? "Can be combined" : null,
      o.first_order_only ? "First order only" : null,
      o.per_customer_limit ? `${o.per_customer_limit} per customer` : null,
    ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p role="status" className={`rounded-xl border px-3 py-2 text-sm font-medium ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Live offers", value: String(live), tone: "text-emerald-600" },
          { label: "Times used", value: String(totalUses), tone: "text-brand-700" },
          { label: "Discount given", value: money(given), tone: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{s.label}</p>
            <p className={`mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3 sm:p-4">
          <div className="relative min-w-[12rem] flex-1">
            <SearchIcon />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or code…" className={searchClass} />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-44">
            <option value="all">All offers</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
            <option value="off">Switched off</option>
          </Select>
          <button type="button" disabled={disabled} onClick={() => setEditing({ ...blank })} className={primaryButton}>
            + New offer
          </button>
        </div>

        {offers.length === 0 && (
          <div className="border-b border-neutral-100 p-4 sm:p-5">
            <p className="text-sm font-bold text-neutral-800">Start with a ready-made offer</p>
            <p className="mb-3 text-xs text-neutral-500">Pick one, adjust the numbers and save. You can change everything.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {TEMPLATES.map((t) => (
                <button key={t.title} type="button" disabled={disabled} onClick={() => setEditing({ ...blank, ...t.draft })} className="rounded-xl border border-neutral-200 p-3 text-start transition hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-50">
                  <span className="block text-sm font-bold text-neutral-900">{t.title}</span>
                  <span className="block text-xs text-neutral-500">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-500">{offers.length === 0 ? "No offers yet." : "No offer matches your search."}</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_6.5rem_6rem_9rem] items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500 lg:grid">
              <span>Offer</span>
              <span>Benefit</span>
              <span>Conditions</span>
              <span>Used</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-neutral-100">
              {list.map((o) => {
                const st = statusOf(o);
                const conds = conditions(o);
                return (
                  <li key={o.id} className="grid gap-x-3 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_6.5rem_6rem_9rem] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-900">{o.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                        {o.funded_by === "supplier" && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">Supplier pays</span>}
                        {o.auto_apply ? <span className="rounded-md bg-violet-50 px-1.5 py-0.5 font-bold text-violet-700">Automatic</span> : <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono font-bold text-neutral-700">{o.code}</span>}
                        <span>{o.starts_at || o.ends_at ? `${dateText(o.starts_at) ?? "now"} → ${dateText(o.ends_at) ?? "no end"}` : "No end date"}</span>
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-brand-800">{benefit(o)}</p>
                    <p className="text-xs text-neutral-600">{conds.length ? conds.join(" · ") : "No conditions"}</p>
                    <p className="text-sm text-neutral-700">
                      <b>{o.used}</b>
                      {o.usage_limit ? <span className="text-neutral-500"> / {o.usage_limit}</span> : null}
                    </p>
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                    <div className="flex flex-wrap gap-1.5 lg:justify-end">
                      <button type="button" disabled={pending} onClick={() => setEditing(draftOf(o))} className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                        Edit
                      </button>
                      <button type="button" disabled={pending} onClick={() => act(() => unwrapAction(setOfferActive)(o.id, !o.is_active), o.is_active ? "Offer switched off." : "Offer switched on.")} className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                        {o.is_active ? "Switch off" : "Switch on"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => confirm(`Delete "${o.name}"? Orders that used it keep their discount.`) && act(() => unwrapAction(deleteOffer)(o.id), "Offer deleted.")}
                        className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {editing && (
        <OfferModal
          draft={editing}
          categories={categories}
          stores={stores}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage({ ok: true, text: "Offer saved." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function OfferModal({ draft, categories, stores, onClose, onSaved }: { draft: Draft; categories: CategoryRow[]; stores: StoreOption[]; onClose: () => void; onSaved: () => void }) {
  const currency = useCurrency();
  const [d, setD] = useState<Draft>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    set("code", Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await unwrapAction(saveOffer)({
        id: d.id,
        name: d.name,
        nameAr: d.nameAr,
        kind: d.kind,
        auto: d.auto,
        code: d.code,
        value: num(d.value),
        maxDiscount: num(d.maxDiscount),
        minOrder: num(d.minOrder),
        categoryId: d.categoryId || null,
        startsAt: fromLocalInput(d.startsAt),
        endsAt: fromLocalInput(d.endsAt),
        usageLimit: num(d.usageLimit),
        perCustomerLimit: num(d.perCustomerLimit),
        firstOrderOnly: d.firstOrderOnly,
        isActive: d.isActive,
        fundedBy: d.fundedBy,
        storeId: d.storeId || null,
        stackable: d.stackable,
        showOnHome: d.showOnHome,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <Modal open onClose={onClose} title={d.id ? "Edit offer" : "New offer"}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Offer name" required hint="Shown to the shopper when it applies.">
            <input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Weekend free delivery" className={inputClass} />
          </Field>
          <Field label="Name in Arabic">
            <ArabicInput english={d.name} value={d.nameAr} onChange={(v) => set("nameAr", v)} className={inputClass} compact />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="What it gives" required>
            <Select value={d.kind} onChange={(e) => set("kind", e.target.value as Draft["kind"])} className="w-full">
              <option value="percent">Percentage off</option>
              <option value="fixed">Amount off</option>
              <option value="free_delivery">Free delivery</option>
            </Select>
          </Field>
          {d.kind !== "free_delivery" && (
            <Field label={d.kind === "percent" ? "Percentage" : `Amount (${currency})`} required>
              <input type="number" min={0} step="any" value={d.value} onChange={(e) => set("value", e.target.value)} className={inputClass} />
            </Field>
          )}
          {d.kind === "percent" && (
            <Field label={`Most it can take off (${currency})`} hint="Optional cap.">
              <input type="number" min={0} step="any" value={d.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} className={inputClass} />
            </Field>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-neutral-700">How shoppers get it</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { auto: false, title: "Coupon code", hint: "The shopper types a code at checkout." },
              { auto: true, title: "Automatic", hint: "Applied by itself when the cart qualifies." },
            ].map((opt) => (
              <button key={opt.title} type="button" onClick={() => set("auto", opt.auto)} className={`rounded-xl border p-3 text-start transition ${d.auto === opt.auto ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300"}`}>
                <span className="block text-sm font-bold text-neutral-900">{opt.title}</span>
                <span className="block text-xs text-neutral-500">{opt.hint}</span>
              </button>
            ))}
          </div>
          {!d.auto && (
            <div className="mt-3 flex items-end gap-2">
              <Field label="Code" required className="flex-1">
                <input value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="e.g. WELCOME10" maxLength={24} className={`${inputClass} font-mono uppercase`} />
              </Field>
              <button type="button" onClick={generate} className={secondaryButton}>
                Generate
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Minimum order (${currency})`} hint="Counted on the items. Empty = no minimum.">
            <input type="number" min={0} step="any" value={d.minOrder} onChange={(e) => set("minOrder", e.target.value)} className={inputClass} />
          </Field>
          {d.kind !== "free_delivery" && (
            <Field label="Only for this supplier" hint="Empty = every supplier.">
              <Select value={d.storeId} onChange={(e) => set("storeId", e.target.value)} className="w-full">
                <option value="">All suppliers</option>
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {d.kind !== "free_delivery" && (
            <Field label="Only for this category" hint="Empty = the whole cart.">
              <Select value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Starts" hint="Empty = right away.">
            <input type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Ends" hint="Empty = no end date.">
            <input type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Total uses allowed" hint="Across all shoppers. Empty = unlimited.">
            <input type="number" min={1} step={1} value={d.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Uses per shopper" hint="Empty = unlimited.">
            <input type="number" min={1} step={1} value={d.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} className={inputClass} />
          </Field>
        </div>

        {d.kind !== "free_delivery" && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-neutral-700">Who pays for the discount</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { v: "fastrack" as const, title: "FasTrack", hint: "The supplier is paid the full price." },
                { v: "supplier" as const, title: "The supplier", hint: "The discount is taken off that supplier's settlement." },
              ].map((opt) => (
                <button key={opt.v} type="button" onClick={() => set("fundedBy", opt.v)} className={`rounded-xl border p-3 text-start transition ${d.fundedBy === opt.v ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300"}`}>
                  <span className="block text-sm font-bold text-neutral-900">{opt.title}</span>
                  <span className="block text-xs text-neutral-500">{opt.hint}</span>
                </button>
              ))}
            </div>
            {d.fundedBy === "supplier" && !d.storeId && <p className="mt-1.5 text-xs font-medium text-amber-700">Choose the supplier above (&quot;Only for this supplier&quot;) so we know whose settlement to charge.</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={d.showOnHome} onChange={(e) => set("showOnHome", e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              Show on the shop home page
              <span className="block text-xs text-neutral-500">Appears in the Offers row while it is active and in date. Turn off for a private code you hand out yourself.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={d.stackable} onChange={(e) => set("stackable", e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              Can be combined with another offer
              <span className="block text-xs text-neutral-500">One more automatic offer that is also marked combinable (for example free delivery) can apply on top. Off = this offer applies alone.</span>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={d.firstOrderOnly} onChange={(e) => set("firstOrderOnly", e.target.checked)} className="h-4 w-4 accent-brand-700" />
            First order only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={d.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-brand-700" />
            Switched on
          </label>
        </div>

        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Save offer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
