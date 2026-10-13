"use client";

import { useState } from "react";
import CategoryDialog from "@/components/admin/CategoryDialog";
import { useLocale } from "@/components/LocaleProvider";
import type { Category } from "@/types/database";

/** The "add" buttons: a main category (top of the page), or a sub-category (inside a category card). Each opens the popup. */
export default function CategoryForm({
  parentOptions,
  defaultParentId,
  compact = false,
}: {
  parentOptions: Category[];
  /** Preselect a parent when adding a sub-category from inside that category's card. */
  defaultParentId?: string | null;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      {defaultParentId || compact ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-50">
          <span className="text-sm leading-none">+</span> {t("category_form.add_subcategory")}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 hover:shadow-md">
          <span className="text-base leading-none">+</span> {t("category_form.add_category")}
        </button>
      )}
      {open && <CategoryDialog parentOptions={parentOptions} defaultParentId={defaultParentId} onClose={() => setOpen(false)} />}
    </>
  );
}
