"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CategoryDialog from "@/components/admin/CategoryDialog";
import CategoryForm from "@/components/admin/CategoryForm";
import { deleteCategory } from "@/lib/actions/admin-categories";
import { errorText, unwrapAction } from "@/lib/errors";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";
import type { Category } from "@/types/database";

function Look({ category, className }: { category: Category; className: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/70 shadow-sm ring-1 ring-white ${className}`}>
      {category.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={category.image_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{category.icon || "🛒"}</span>
      )}
    </span>
  );
}

/**
 * A main category as a compact glass tile. Click it to open everything about it in a popup (its sub-categories, and the
 * buttons to edit, add and delete), so the page itself never turns into a long list.
 */
export default function CategoryTile({ category, subs, parentOptions, counts }: { category: Category; subs: Category[]; parentOptions: Category[]; counts: Record<string, number> }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = (counts[category.id] ?? 0) + subs.reduce((n, s) => n + (counts[s.id] ?? 0), 0);

  function remove(c: Category) {
    if (!confirm(t("category_form.confirm_delete", { name: c.name }))) return;
    setError(null);
    start(async () => {
      try {
        await unwrapAction(deleteCategory)(c.id);
        if (c.id === category.id) setOpen(false);
        router.refresh();
      } catch (err) {
        setError(errorText(err, t("category_form.could_not_delete")));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-filter={[category.name, category.name_ar ?? "", ...subs.map((s) => `${s.name} ${s.name_ar ?? ""}`)].join(" ")}
        className="group flex flex-col items-center gap-2 rounded-3xl border border-white/70 bg-white/45 p-4 text-center shadow-[0_6px_24px_rgba(30,64,175,0.08)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_12px_32px_rgba(30,64,175,0.16)]"
      >
        <Look category={category} className="h-16 w-16 rounded-2xl text-4xl transition group-hover:scale-105" />
        <span className="w-full min-w-0">
          <span className="block truncate text-sm font-extrabold tracking-tight text-neutral-900">{localizedName(category, locale)}</span>
          <span className="block text-[11px] font-medium text-neutral-500">
            {subs.length} sub-categor{subs.length === 1 ? "y" : "ies"} · {total} product{total === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex min-h-[1.5rem] flex-wrap justify-center gap-1">
          {subs.slice(0, 3).map((s) => (
            <span key={s.id} className="max-w-[7rem] truncate rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 ring-1 ring-white">
              {localizedName(s, locale)}
            </span>
          ))}
          {subs.length > 3 && <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-[10px] font-bold text-brand-700">+{subs.length - 3}</span>}
        </span>
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} size="xl">
          <div className="-m-5 flex flex-col">
            <div className="flex items-center gap-4 border-b border-neutral-100 bg-gradient-to-r from-brand-50 via-white to-white px-5 py-4">
              <Look category={category} className="h-16 w-16 rounded-2xl text-4xl" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-extrabold tracking-tight text-neutral-900">{localizedName(category, locale)}</h2>
                <p className="truncate text-xs text-neutral-500">
                  {category.name_ar && locale !== "ar" ? `${category.name_ar} · ` : ""}/{category.slug} · order {category.sort_order}
                </p>
                <p className="mt-1 text-xs font-semibold text-brand-700">
                  {total} product{total === 1 ? "" : "s"} in all
                </p>
              </div>
              <button type="button" onClick={() => setEditing(category)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-brand-400 hover:text-brand-700">
                ✎ Edit
              </button>
              <button type="button" onClick={() => remove(category)} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                🗑 Delete
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <div className="bg-neutral-50 p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">Sub-categories ({subs.length})</h3>
                <CategoryForm parentOptions={parentOptions} defaultParentId={category.id} />
              </div>
              {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
              {subs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">No sub-categories yet. Add one to split this category into smaller groups.</p>
              ) : (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {subs.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <Look category={s} className="h-11 w-11 rounded-xl text-2xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-neutral-900">{localizedName(s, locale)}</p>
                        <p className="truncate text-[11px] text-neutral-500">
                          {s.name_ar && locale !== "ar" ? `${s.name_ar} · ` : ""}order {s.sort_order}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{counts[s.id] ?? 0}</span>
                      <button type="button" aria-label="Edit" title="Edit" onClick={() => setEditing(s)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-brand-50 hover:text-brand-700">
                        ✎
                      </button>
                      <button type="button" aria-label="Delete" title="Delete" disabled={pending} onClick={() => remove(s)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40">
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}

      {editing && <CategoryDialog existing={editing} parentOptions={parentOptions} onClose={() => setEditing(null)} />}
    </>
  );
}
