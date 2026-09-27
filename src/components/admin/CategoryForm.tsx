"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/lib/actions/admin-categories";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import type { Category } from "@/types/database";

export default function CategoryForm({
  existing,
  parentOptions,
  defaultParentId,
  onDone,
}: {
  existing?: Category;
  /** Top-level categories only — a subcategory can't itself be a parent (kept to two levels, like Amazon/Noon). */
  parentOptions: Category[];
  /** Preselect a parent when adding a subcategory from within that parent's group. */
  defaultParentId?: string | null;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.name_ar ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(String(existing?.sort_order ?? 0));
  const [parentId, setParentId] = useState(existing?.parent_id ?? defaultParentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const availableParents = parentOptions.filter((c) => c.id !== existing?.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (existing) {
          await updateCategory(existing.id, {
            name,
            nameAr: nameAr || undefined,
            slug,
            icon: icon || undefined,
            imageUrl: imageUrl || undefined,
            sortOrder: Number(sortOrder) || 0,
            parentId: parentId || null,
          });
          onDone?.();
        } else {
          await createCategory({
            name,
            nameAr: nameAr || undefined,
            slug: slug || undefined,
            icon: icon || undefined,
            imageUrl: imageUrl || undefined,
            sortOrder: Number(sortOrder) || 0,
            parentId: parentId || null,
          });
          setImageUrl(null);
          setName("");
          setNameAr("");
          setSlug("");
          setIcon("");
          setSortOrder("0");
          setParentId(defaultParentId ?? "");
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save category.");
      }
    });
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-500">Category photo</p>
        <ImageUploader value={imageUrl} onChange={setImageUrl} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Name (e.g. Snacks)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Name in Arabic (optional)"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          dir="rtl"
        />
        <input
          placeholder={existing ? "Slug" : "Slug (auto from name if blank)"}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Emoji fallback (e.g. 🍿) — shown if no photo"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Sort order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">No parent — top-level category</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              Subcategory of {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : existing ? "Save changes" : "Add category"}
        </button>
        <button
          type="button"
          onClick={() => (existing ? onDone?.() : setOpen(false))}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (existing) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4">{formBody}</div>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <span className="text-base leading-none">+</span> {defaultParentId ? "Add subcategory" : "Add category"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={defaultParentId ? "Add a subcategory" : "Add a new category"}>
        {formBody}
      </Modal>
    </>
  );
}
