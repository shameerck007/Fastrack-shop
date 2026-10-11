"use client";


import { unwrapAction } from "@/lib/errors";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Select from "@/components/ui/Select";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { addCommissionException, deleteCommissionRule, previewCommission, saveCategoryRates, saveDefaultCommission } from "@/lib/actions/admin-commission";

export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number | null;
}
export interface StoreOption {
  id: string;
  name: string;
  /** The supplier's own agreed rate (used when no rule matches). */
  rate: number;
}
export interface RuleRow {
  id: string;
  store_id: string | null;
  category_id: string | null;
  master_id: string | null;
  rate: number | string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  note: string | null;
}

type Tab = "categories" | "exceptions" | "checker";

const searchClass = "h-10 w-full rounded-xl border border-neutral-300 bg-white ps-9 pe-3 text-sm placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3">
          <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[12rem] flex-1">
      <svg className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={searchClass} />
    </div>
  );
}

export default function CommissionManager({ categories, stores, rules, defaultRate, disabled }: { categories: CategoryRow[]; stores: StoreOption[]; rules: RuleRow[]; defaultRate: number; disabled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("categories");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  // Category rules apply to every supplier: no supplier and no single product.
  const categoryRule = useMemo(() => new Map(rules.filter((r) => r.category_id && !r.store_id && !r.master_id && r.is_active).map((r) => [r.category_id as string, Number(r.rate)])), [rules]);
  const exceptions = rules.filter((r) => r.store_id || r.master_id);
  const rated = categories.filter((c) => categoryRule.has(c.id));
  const average = rated.length ? rated.reduce((s, c) => s + (categoryRule.get(c.id) ?? 0), 0) / rated.length : defaultRate;

  function run(fn: () => Promise<{ error?: string }>, okText: string) {
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: okText });
        router.refresh();
      }
    });
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "categories", label: "Category rates", count: rated.length },
    { id: "exceptions", label: "Supplier exceptions", count: exceptions.length },
    { id: "checker", label: "Rate checker" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p role="status" className={`rounded-xl border px-3 py-2 text-sm font-medium ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DefaultRate defaultRate={defaultRate} disabled={disabled || pending} onSave={(r) => run(() => unwrapAction(saveDefaultCommission)(r), "Default rate saved.")} />
        <Stat label="Average category rate" value={`${Math.round(average * 10) / 10}%`} hint={`${rated.length} of ${categories.length} categories have a rate`} tone="text-blue-700" />
        <Stat label="Supplier exceptions" value={String(exceptions.length)} hint={exceptions.length ? "Override the category rate" : "None yet"} tone="text-amber-600" />
        <div className="col-span-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm lg:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Which rate applies</p>
          <ol className="mt-1 space-y-0.5 text-xs text-neutral-600">
            {["Product rule", "Supplier + category", "Supplier (all products)", "Category (sub-categories inherit)", "Default rate"].map((t, i) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-800">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${tab === t.id ? "bg-blue-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              {t.label}
              {t.count != null && <span className={`ms-1.5 rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-neutral-100 text-neutral-500"}`}>{t.count}</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">The rate is saved on each order line when the order is placed, so past orders never change. FasTrack&apos;s own products carry no commission.</p>
      </div>

      {tab === "categories" && <CategoryRates categories={categories} categoryRule={categoryRule} defaultRate={defaultRate} disabled={disabled} onSaved={(n) => { setMessage({ ok: true, text: `${n} rate${n === 1 ? "" : "s"} saved.` }); router.refresh(); }} onError={(text) => setMessage({ ok: false, text })} />}

      {tab === "exceptions" && (
        <Exceptions
          exceptions={exceptions}
          stores={stores}
          categories={categories}
          disabled={disabled}
          pending={pending}
          onAdd={() => setAdding(true)}
          onRemove={(id) => run(() => unwrapAction(deleteCommissionRule)(id), "Exception removed.")}
        />
      )}

      {tab === "checker" && <Simulator stores={stores} categories={categories} disabled={disabled} />}

      {adding && (
        <ExceptionModal
          stores={stores}
          categories={categories}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setMessage({ ok: true, text: "Exception added." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DefaultRate({ defaultRate, disabled, onSave }: { defaultRate: number; disabled: boolean; onSave: (r: number) => void }) {
  const [v, setV] = useState(String(defaultRate));
  const changed = v.trim() !== "" && Number(v) !== defaultRate;
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700/70">Default rate</p>
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" min={0} max={100} step={0.5} value={v} onChange={(e) => setV(e.target.value)} aria-label="Default commission rate" className="h-9 w-20 rounded-lg border border-blue-200 bg-white px-2.5 text-base font-extrabold text-blue-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <span className="text-sm font-bold text-blue-700">%</span>
        {changed && (
          <button type="button" disabled={disabled} onClick={() => onSave(Number(v))} className="ms-auto h-8 rounded-full bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
            Save
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">Used when nothing else applies</p>
    </div>
  );
}

function CategoryRates({ categories, categoryRule, defaultRate, disabled, onSaved, onError }: { categories: CategoryRow[]; categoryRule: Map<string, number>; defaultRate: number; disabled: boolean; onSaved: (n: number) => void; onError: (t: string) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "own" | "inherited">("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const parents = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const kids = useMemo(() => {
    const m = new Map<string, CategoryRow[]>();
    for (const c of categories) if (c.parent_id) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c]);
    return m;
  }, [categories]);

  const savedStr = (id: string) => (categoryRule.has(id) ? String(categoryRule.get(id)) : "");
  const valueOf = (id: string) => (id in drafts ? drafts[id] : savedStr(id));
  const dirtyIds = Object.keys(drafts).filter((id) => drafts[id].trim() !== savedStr(id));
  const setDraft = (id: string, v: string) => setDrafts((d) => ({ ...d, [id]: v }));

  const needle = q.trim().toLowerCase();
  const passes = (c: CategoryRow) => (!needle || c.name.toLowerCase().includes(needle)) && (filter === "all" || (filter === "own") === categoryRule.has(c.id));
  const visible = parents
    .map((p) => {
      const sub = (kids.get(p.id) ?? []).filter(passes);
      const selfHit = passes(p);
      return { p, sub, show: selfHit || sub.length > 0, selfHit };
    })
    .filter((x) => x.show);
  const searching = needle !== "" || filter !== "all";

  function saveAll() {
    const items = dirtyIds.map((id) => ({ categoryId: id, rate: drafts[id].trim() === "" ? null : Number(drafts[id]) }));
    if (items.some((i) => i.rate !== null && !(i.rate >= 0 && i.rate <= 100))) return onError("Every rate must be between 0 and 100.");
    start(async () => {
      const res = await unwrapAction(saveCategoryRates)(items);
      if (res.error) onError(res.error);
      else {
        setDrafts({});
        onSaved(res.saved ?? items.length);
      }
    });
  }

  const allOpen = open.size >= parents.length;

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3 sm:p-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search categories…" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-44">
          <option value="all">All categories</option>
          <option value="own">With their own rate</option>
          <option value="inherited">Inheriting a rate</option>
        </Select>
        <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(parents.map((p) => p.id)))} className={secondaryButton}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_8rem] items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 sm:grid">
        <span>Category</span>
        <span>Commission</span>
        <span>Applies</span>
      </div>

      {visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-neutral-400">No category matches your search.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {visible.map(({ p, sub }) => {
            const expanded = searching || open.has(p.id);
            const all = kids.get(p.id) ?? [];
            return (
              <li key={p.id}>
                <Row
                  cat={p}
                  value={valueOf(p.id)}
                  saved={savedStr(p.id)}
                  status={categoryRule.has(p.id) ? { own: true, text: "Own rate" } : { own: false, text: `Default ${defaultRate}%` }}
                  placeholder={`${defaultRate}`}
                  onChange={(v) => setDraft(p.id, v)}
                  lead={
                    all.length > 0 ? (
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse" : "Expand"}
                        onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                      >
                        <svg className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l7 6-7 6V4z" /></svg>
                      </button>
                    ) : (
                      <span className="w-6 shrink-0" />
                    )
                  }
                  count={all.length}
                  bold
                />
                {expanded &&
                  sub.map((c) => (
                    <Row
                      key={c.id}
                      cat={c}
                      value={valueOf(c.id)}
                      saved={savedStr(c.id)}
                      status={categoryRule.has(c.id) ? { own: true, text: "Own rate" } : { own: false, text: `Uses ${categoryRule.get(p.id) ?? defaultRate}%` }}
                      placeholder={`${categoryRule.get(p.id) ?? defaultRate}`}
                      onChange={(v) => setDraft(c.id, v)}
                      lead={<span className="w-6 shrink-0 text-center text-neutral-300">↳</span>}
                      child
                    />
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      {dirtyIds.length > 0 && (
        <div className="sticky bottom-3 z-10 m-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-2.5 shadow-lg">
          <p className="text-sm font-semibold text-neutral-800">
            {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDrafts({})} className={secondaryButton} disabled={pending}>
              Discard
            </button>
            <button type="button" onClick={saveAll} className={primaryButton} disabled={disabled || pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ cat, value, saved, status, placeholder, onChange, lead, child, bold, count }: { cat: CategoryRow; value: string; saved: string; status: { own: boolean; text: string }; placeholder: string; onChange: (v: string) => void; lead: React.ReactNode; child?: boolean; bold?: boolean; count?: number }) {
  const dirty = value.trim() !== saved;
  const bad = value.trim() !== "" && !(Number(value) >= 0 && Number(value) <= 100);
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-3 gap-y-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] ${child ? "bg-neutral-50/50" : ""}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {lead}
        <span className={`truncate text-sm ${bold ? "font-bold text-neutral-900" : "text-neutral-700"}`}>{cat.name}</span>
        {count ? <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-500">{count}</span> : null}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value}
          placeholder={placeholder}
          aria-label={`${cat.name} commission %`}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 w-full rounded-lg border bg-white px-2.5 text-sm font-semibold placeholder:font-normal placeholder:text-neutral-300 focus:outline-none focus:ring-2 ${bad ? "border-rose-400 focus:ring-rose-400/20" : dirty ? "border-amber-400 bg-amber-50/50 focus:ring-amber-400/20" : "border-neutral-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
        />
        <span className="text-xs text-neutral-400">%</span>
      </div>
      <span className={`col-span-2 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold sm:col-span-1 ${status.own ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>{status.text}</span>
    </div>
  );
}

function Exceptions({ exceptions, stores, categories, disabled, pending, onAdd, onRemove }: { exceptions: RuleRow[]; stores: StoreOption[]; categories: CategoryRow[]; disabled: boolean; pending: boolean; onAdd: () => void; onRemove: (id: string) => void }) {
  const [q, setQ] = useState("");
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? "All suppliers";
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "All categories";
  const needle = q.trim().toLowerCase();
  const list = exceptions.filter((r) => !needle || `${storeName(r.store_id)} ${r.master_id ? "one product" : catName(r.category_id)} ${r.note ?? ""}`.toLowerCase().includes(needle));
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3 sm:p-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search supplier, category or note…" />
        <button type="button" disabled={disabled} onClick={onAdd} className={primaryButton}>
          + Add exception
        </button>
      </div>
      {list.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-bold text-neutral-700">{exceptions.length === 0 ? "No exceptions yet" : "Nothing matches your search"}</p>
          <p className="mt-1 text-xs text-neutral-500">{exceptions.length === 0 ? "Add one to give a single supplier a different rate, for all products or one category, optionally for a limited time." : "Try a different word."}</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_5rem_5rem] items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 md:grid">
            <span>Supplier</span>
            <span>Applies to</span>
            <span>Period</span>
            <span>Rate</span>
            <span />
          </div>
          <ul className="divide-y divide-neutral-100">
            {list.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_5rem_5rem]">
                <p className="truncate text-sm font-bold text-neutral-900">{storeName(r.store_id)}</p>
                <p className="order-3 text-xs text-neutral-600 md:order-none md:text-sm">{r.master_id ? "One product" : catName(r.category_id)}</p>
                <p className="order-4 text-xs text-neutral-500 md:order-none">
                  {r.starts_on || r.ends_on ? `${r.starts_on ?? "now"} → ${r.ends_on ?? "no end"}` : "No end date"}
                  {r.note ? ` · ${r.note}` : ""}
                  {!r.is_active ? " · off" : ""}
                </p>
                <span className="order-2 w-fit rounded-full bg-amber-50 px-3 py-0.5 text-sm font-extrabold text-amber-700 md:order-none">{Number(r.rate)}%</span>
                <button type="button" disabled={pending} onClick={() => onRemove(r.id)} className="order-5 h-8 w-fit rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 md:order-none">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Simulator({ stores, categories, disabled }: { stores: StoreOption[]; categories: CategoryRow[]; disabled: boolean }) {
  const [storeId, setStoreId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("100");
  const [result, setResult] = useState<{ error?: string; rate?: number; commission?: number; supplierGets?: number } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card title="Rate checker" hint="Pick a supplier, a category and a price to see the commission that would apply today.">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
        <Field label="Supplier">
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full">
            <option value="">Choose a supplier</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Selling price">
          <input type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </Field>
        <button type="button" disabled={disabled || pending || !storeId} onClick={() => start(async () => setResult(await unwrapAction(previewCommission)({ storeId, categoryId: categoryId || null, price: Number(price) })))} className={primaryButton}>
          {pending ? "…" : "Check"}
        </button>
      </div>
      {result &&
        (result.error ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{result.error}</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Rate" value={`${result.rate}%`} tone="text-blue-700" />
            <Stat label="FasTrack keeps" value={String(result.commission)} tone="text-amber-600" />
            <Stat label="Supplier receives" value={String(result.supplierGets)} tone="text-emerald-600" />
          </div>
        ))}
    </Card>
  );
}

function ExceptionModal({ stores, categories, onClose, onSaved }: { stores: StoreOption[]; categories: CategoryRow[]; onClose: () => void; onSaved: () => void }) {
  const [storeId, setStoreId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [rate, setRate] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Modal open onClose={onClose} title="Add a commission exception">
      <div className="flex flex-col gap-4">
        <Field label="Supplier" required>
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full">
            <option value="">Choose a supplier</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Only for this category" hint="Leave empty for all of the supplier's products.">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Commission %" required>
          <input type="number" min={0} max={100} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From (optional)">
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Until (optional)">
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Launch offer for Q1" className={inputClass} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !storeId || rate === ""}
            className={primaryButton}
            onClick={() =>
              start(async () => {
                const res = await unwrapAction(addCommissionException)({ storeId, categoryId: categoryId || null, rate: Number(rate), startsOn, endsOn, note });
                if (res.error) setError(res.error);
                else onSaved();
              })
            }
          >
            {pending ? "Saving…" : "Add exception"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
