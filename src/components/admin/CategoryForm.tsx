"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/lib/actions/admin-categories";
import { autoTranslateToArabic } from "@/lib/actions/translate";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";
import type { Category } from "@/types/database";
import Select from "@/components/ui/Select";

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
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.name_ar ?? "");
  const [nameArEdited, setNameArEdited] = useState(Boolean(existing?.name_ar));
  const [translating, setTranslating] = useState(false);
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(String(existing?.sort_order ?? 0));
  const [parentId, setParentId] = useState(existing?.parent_id ?? defaultParentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const availableParents = parentOptions.filter((c) => c.id !== existing?.id);

  async function autoTranslate(sourceName: string) {
    if (!sourceName.trim() || nameArEdited) return;
    setTranslating(true);
    try {
      const translated = await autoTranslateToArabic(sourceName);
      if (translated) setNameAr(translated);
    } finally {
      setTranslating(false);
    }
  }

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
          setNameArEdited(false);
          setSlug("");
          setIcon("");
          setSortOrder("0");
          setParentId(defaultParentId ?? "");
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("category_form.could_not_save"));
      }
    });
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-500">{t("category_form.category_photo")}</p>
        <ImageUploader value={imageUrl} onChange={setImageUrl} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder={t("category_form.name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => autoTranslate(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex items-center gap-1.5">
          <input
            placeholder={translating ? t("category_form.translating") : t("category_form.name_ar_placeholder")}
            value={nameAr}
            onChange={(e) => {
              setNameAr(e.target.value);
              setNameArEdited(true);
            }}
            className="min-w-0 flex-1 min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            dir="rtl"
          />
          <button
            type="button"
            title={t("category_form.auto_translate")}
            disabled={translating || !name.trim()}
            onClick={() => {
              setNameArEdited(false);
              autoTranslate(name);
            }}
            className="shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-xs hover:bg-neutral-50 disabled:opacity-50"
          >
            {translating ? "…" : "🌐"}
          </button>
        </div>
        <input
          placeholder={existing ? t("category_form.slug_placeholder") : t("category_form.slug_auto_placeholder")}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          placeholder={t("category_form.icon_placeholder")}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          type="number"
          placeholder={t("category_form.sort_order_placeholder")}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <Select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">{t("category_form.no_parent")}</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {t("category_form.subcategory_of", { name: localizedName(p, locale) })}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("common.saving") : existing ? t("category_form.save_changes") : t("category_form.add_category")}
        </button>
        <button
          type="button"
          onClick={() => (existing ? onDone?.() : setOpen(false))}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );

  if (existing) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4">{formBody}</div>;
  }

  return (
    <>
      {defaultParentId ? (
        // Repeated once per top-level category on the admin page — a small
        // inline link (Amazon/Noon seller-console style), not a full-size
        // button, so a page with many categories doesn't turn into a wall
        // of identical blue pills.
        <button
          onClick={() => setOpen(true)}
          className="ms-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <span className="text-sm leading-none">+</span> {t("category_form.add_subcategory")}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
        >
          <span className="text-base leading-none">+</span> {t("category_form.add_category")}
        </button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={defaultParentId ? t("category_form.add_a_subcategory") : t("category_form.add_a_new_category")}
      >
        {formBody}
      </Modal>
    </>
  );
}
