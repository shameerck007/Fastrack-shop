"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/lib/actions/admin-categories";
import CategoryForm from "@/components/admin/CategoryForm";
import type { Category } from "@/types/database";

export default function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (editing) {
    return <CategoryForm existing={category} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.icon || "🛒"}</span>
        <div>
          <p className="text-sm font-medium">{category.name}</p>
          <p className="text-xs text-neutral-400">
            /{category.slug} · order {category.sort_order}
            {category.name_ar && ` · ${category.name_ar}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {error && <span className="text-red-600">{error}</span>}
        <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline">
          Edit
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!confirm(`Delete "${category.name}"? This can't be undone.`)) return;
              try {
                await deleteCategory(category.id);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not delete.");
              }
            })
          }
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
