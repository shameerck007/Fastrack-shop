"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/lib/actions/admin-categories";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import type { Category } from "@/types/database";

export default function CategoryForm({
  existing,
  onDone,
}: {
  existing?: Category;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.name_ar ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(String(existing?.sort_order ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
          });
          setImageUrl(null);
          setName("");
          setNameAr("");
          setSlug("");
          setIcon("");
          setSortOrder("0");
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
        <span className="text-base leading-none">+</span> Add category
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a new category">
        {formBody}
      </Modal>
    </>
  );
}
