"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Select from "@/components/ui/Select";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { addCommissionException, deleteCommissionRule, previewCommission, saveCategoryRate, saveDefaultCommission } from "@/lib/actions/admin-commission";

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

function Card({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3">
        <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function CommissionManager({ categories, stores, rules, defaultRate, disabled }: { categories: CategoryRow[]; stores: StoreOption[]; rules: RuleRow[]; defaultRate: number; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  const parents = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  // Category rules apply to every supplier: no supplier and no single product.
  const categoryRule = useMemo(() => new Map(rules.filter((r) => r.category_id && !r.store_id && !r.master_id && r.is_active).map((r) => [r.category_id as string, Number(r.rate)])), [rules]);
  const exceptions = rules.filter((r) => r.store_id || r.master_id);
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? "All suppliers";
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "All categories";

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

  return (
    <div className="flex flex-col gap-4">
      {message && <p className={`rounded-xl px-3 py-2 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-900"}`}>{message.text}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="How a commission is chosen" hint="The most specific rule wins." className="lg:col-span-2">
          <ol className="grid gap-1.5 text-sm text-neutral-700 sm:grid-cols-2">
            {["A product rule", "A supplier and category rule", "A category rule (sub-categories inherit)", "The supplier's own rate (settlement page)", "The default rate below"].map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-800">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-neutral-500">The rate is saved on each order line when the order is placed, so changing a rule never changes past orders. FasTrack&apos;s own products carry no commission.</p>
        </Card>
        <DefaultRate defaultRate={defaultRate} disabled={disabled || pending} onSave={(r) => run(() => saveDefaultCommission(r), "Default rate saved.")} />
      </div>

      <Card title="Category rates" hint="Leave a category empty to use its parent's rate, then the supplier's own rate, then the default.">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_4.5rem] items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <span>Category</span>
            <span>Commission %</span>
            <span />
          </div>
          <ul className="divide-y divide-neutral-100">
            {parents.map((p) => (
              <li key={p.id}>
                <CategoryLine cat={p} rate={categoryRule.get(p.id) ?? null} inherited={`Default ${defaultRate}%`} disabled={disabled || pending} onSave={(r) => run(() => saveCategoryRate(p.id, r), `${p.name} saved.`)} />
                {childrenOf(p.id).map((c) => (
                  <CategoryLine key={c.id} cat={c} child rate={categoryRule.get(c.id) ?? null} inherited={`Uses ${categoryRule.get(p.id) ?? defaultRate}%`} disabled={disabled || pending} onSave={(r) => run(() => saveCategoryRate(c.id, r), `${c.name} saved.`)} />
                ))}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card title="Exceptions" hint="A special rate for one supplier, for all its products or only one category. Optional dates make it temporary.">
        <div className="mb-3 flex justify-end">
          <button type="button" disabled={disabled} onClick={() => setAdding(true)} className={primaryButton}>
            + Add exception
          </button>
        </div>
        {exceptions.length === 0 ? (
          <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm text-neutral-400">No exceptions yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {exceptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-bold text-neutral-900">
                    {storeName(r.store_id)} <span className="font-normal text-neutral-400">·</span> {r.master_id ? "One product" : catName(r.category_id)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {r.starts_on || r.ends_on ? `${r.starts_on ?? "from now"} to ${r.ends_on ?? "no end"}` : "No end date"}
                    {r.note ? ` · ${r.note}` : ""}
                    {!r.is_active ? " · switched off" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-800">{Number(r.rate)}%</span>
                <button type="button" disabled={pending} onClick={() => run(() => deleteCommissionRule(r.id), "Exception removed.")} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Simulator stores={stores} categories={categories} disabled={disabled} />

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
  return (
    <Card title="Default rate" hint="Used when nothing else applies.">
      <div className="flex items-center gap-2">
        <input type="number" min={0} max={100} step={0.5} value={v} onChange={(e) => setV(e.target.value)} className={`${inputClass} w-28`} />
        <span className="text-sm font-semibold text-neutral-500">%</span>
        <button type="button" disabled={disabled || Number(v) === defaultRate} onClick={() => onSave(Number(v))} className={primaryButton}>
          Save
        </button>
      </div>
    </Card>
  );
}

function CategoryLine({ cat, child, rate, inherited, disabled, onSave }: { cat: CategoryRow; child?: boolean; rate: number | null; inherited: string; disabled: boolean; onSave: (r: number | null) => void }) {
  const [v, setV] = useState(rate == null ? "" : String(rate));
  const dirty = (v.trim() === "" ? null : Number(v)) !== rate;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem_4.5rem] items-center gap-3 px-3 py-2">
      <span className={`truncate text-sm ${child ? "ps-5 text-neutral-600" : "font-bold text-neutral-900"}`}>
        {child && <span className="me-1 text-neutral-300">↳</span>}
        {cat.name}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={v}
          placeholder={inherited}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && onSave(v.trim() === "" ? null : Number(v))}
          className="h-9 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-sm placeholder:text-xs placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <span className="text-xs text-neutral-400">%</span>
      </div>
      <button type="button" disabled={disabled || !dirty} onClick={() => onSave(v.trim() === "" ? null : Number(v))} className="h-8 rounded-full bg-blue-700 text-xs font-bold text-white transition hover:bg-blue-800 disabled:bg-neutral-100 disabled:text-neutral-300">
        Save
      </button>
    </div>
  );
}

function Simulator({ stores, categories, disabled }: { stores: StoreOption[]; categories: CategoryRow[]; disabled: boolean }) {
  const [storeId, setStoreId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("100");
  const [result, setResult] = useState<{ error?: string; rate?: number; commission?: number; supplierGets?: number } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card title="Try it" hint="Pick a supplier, a category and a price to see the commission that would apply today.">
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
        <button type="button" disabled={disabled || pending || !storeId} onClick={() => start(async () => setResult(await previewCommission({ storeId, categoryId: categoryId || null, price: Number(price) })))} className={primaryButton}>
          {pending ? "…" : "Check"}
        </button>
      </div>
      {result &&
        (result.error ? (
          <p className="mt-3 text-sm font-medium text-blue-900">{result.error}</p>
        ) : (
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Commission <b>{result.rate}%</b> = <b>{result.commission}</b>. The supplier receives <b>{result.supplierGets}</b>.
          </p>
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
                {s.name} (now {s.rate}%)
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
        {error && <p className="text-sm font-medium text-blue-900">{error}</p>}
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
                const res = await addCommissionException({ storeId, categoryId: categoryId || null, rate: Number(rate), startsOn, endsOn, note });
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
