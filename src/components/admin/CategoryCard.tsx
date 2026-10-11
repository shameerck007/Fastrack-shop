"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CategoryDialog from "@/components/admin/CategoryDialog";
import CategoryForm from "@/components/admin/CategoryForm";
import { deleteCategory } from "@/lib/actions/admin-categories";
import { errorText, unwrapAction } from "@/lib/errors";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";
import type { Category } from "@/types/database";

function Thumb({ category, size }: { category: Category; size: "lg" | "sm" }) {
  const box = size === "lg" ? "h-14 w-14 rounded-2xl text-3xl" : "h-8 w-8 rounded-lg text-lg";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-neutral-200 bg-neutral-50 ${box}`}>
      {category.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={category.image_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{category.icon || "🛒"}</span>
      )}
    </span>
  );
}

function IconButton({ label, onClick, danger, disabled, children }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition disabled:opacity-40 ${danger ? "text-neutral-400 hover:bg-rose-50 hover:text-rose-600" : "text-neutral-400 hover:bg-blue-50 hover:text-blue-700"}`}>
      {children}
    </button>
  );
}

/** One main category as a card: its look and numbers on top, its sub-categories listed inside, and the actions to change it. */
export default function CategoryCard({
  category,
  subs,
  parentOptions,
  counts,
}: {
  category: Category;
  subs: Category[];
  parentOptions: Category[];
  /** Products per category id (empty before migration 0091). */
  counts: Record<string, number>;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const own = counts[category.id] ?? 0;
  const total = own + subs.reduce((n, s) => n + (counts[s.id] ?? 0), 0);

  function remove(c: Category) {
    if (!confirm(t("category_form.confirm_delete", { name: c.name }))) return;
    setError(null);
    start(async () => {
      try {
        await unwrapAction(deleteCategory)(c.id);
        router.refresh();
      } catch (err) {
        setError(errorText(err, t("category_form.could_not_delete")));
      }
    });
  }

  return (
    <section className="flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm" data-filter={[category.name, category.name_ar ?? "", ...subs.map((s) => `${s.name} ${s.name_ar ?? ""}`)].join(" ")}>
      <div className="flex items-start gap-3 p-4">
        <Thumb category={category} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold tracking-tight text-neutral-900">{localizedName(category, locale)}</h2>
          <p className="truncate text-xs text-neutral-400">{category.name_ar && locale !== "ar" ? `${category.name_ar} · ` : ""}/{category.slug}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{total} product{total === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">{subs.length} sub-categor{subs.length === 1 ? "y" : "ies"}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-500">Order {category.sort_order}</span>
          </p>
        </div>
        <div className="flex shrink-0">
          <IconButton label="Edit" onClick={() => setEditing(category)}>
            ✎
          </IconButton>
          <IconButton label="Delete" danger disabled={pending} onClick={() => remove(category)}>
            🗑
          </IconButton>
        </div>
      </div>

      {subs.length > 0 && (
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 px-4 py-2">
              <Thumb category={s} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-800">{localizedName(s, locale)}</p>
                <p className="truncate text-[11px] text-neutral-400">{s.name_ar && locale !== "ar" ? `${s.name_ar} · ` : ""}order {s.sort_order}</p>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600">{counts[s.id] ?? 0}</span>
              <IconButton label="Edit" onClick={() => setEditing(s)}>
                ✎
              </IconButton>
              <IconButton label="Delete" danger disabled={pending} onClick={() => remove(s)}>
                🗑
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5">
        <CategoryForm parentOptions={parentOptions} defaultParentId={category.id} />
        {error && <p className="min-w-0 flex-1 text-end text-xs font-medium text-rose-700">{error}</p>}
      </div>

      {editing && <CategoryDialog existing={editing} parentOptions={parentOptions} onClose={() => setEditing(null)} />}
    </section>
  );
}
