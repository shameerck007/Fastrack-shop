"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/lib/actions/admin-categories";
import CategoryForm from "@/components/admin/CategoryForm";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";
import type { Category } from "@/types/database";

export default function CategoryRow({
  category,
  parentOptions,
  indent,
}: {
  category: Category;
  parentOptions: Category[];
  indent?: boolean;
}) {
  const { t, locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (editing) {
    return <CategoryForm existing={category} parentOptions={parentOptions} onDone={() => setEditing(false)} />;
  }

  const name = localizedName(category, locale);

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 ${indent ? "ms-8" : ""}`}>
      <div className="flex items-center gap-3">
        {indent && <span className="text-neutral-300">↳</span>}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
          {category.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={category.image_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">{category.icon || "🛒"}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-neutral-400">
            {t("category_form.order_label", { slug: category.slug, order: category.sort_order })}
            {category.name_ar && ` · ${category.name_ar}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {error && <span className="text-red-600">{error}</span>}
        <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline">
          {t("addresses.edit")}
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!confirm(t("category_form.confirm_delete", { name: category.name }))) return;
              try {
                await deleteCategory(category.id);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : t("category_form.could_not_delete"));
              }
            })
          }
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          {t("addresses.delete")}
        </button>
      </div>
    </div>
  );
}
