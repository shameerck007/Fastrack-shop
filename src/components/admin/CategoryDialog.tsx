"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/lib/actions/admin-categories";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import ImageUploader from "@/components/ImageUploader";
import ArabicInput from "@/components/ui/ArabicInput";
import Select from "@/components/ui/Select";
import { Field, inputClass } from "@/components/ui/Form";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";
import { unwrapAction } from "@/lib/errors";
import type { Category } from "@/types/database";

/** Add or edit a category in a popup: how it looks (photo, icon), what it is called, and where it sits. */
export default function CategoryDialog({
  existing,
  parentOptions,
  defaultParentId,
  onClose,
}: {
  existing?: Category;
  /** Top-level categories only: a sub-category can't itself be a parent (two levels, like Amazon and Noon). */
  parentOptions: Category[];
  defaultParentId?: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.name_ar ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(String(existing?.sort_order ?? 0));
  const [parentId, setParentId] = useState(existing?.parent_id ?? defaultParentId ?? "");
  const parents = parentOptions.filter((c) => c.id !== existing?.id);
  const parent = parents.find((p) => p.id === parentId);

  async function save(): Promise<string | void> {
    if (!name.trim()) return "Enter the category name.";
    const body = { name: name.trim(), nameAr: nameAr.trim() || undefined, icon: icon.trim() || undefined, imageUrl: imageUrl || undefined, sortOrder: Number(sortOrder) || 0, parentId: parentId || null };
    if (existing) await unwrapAction(updateCategory)(existing.id, { ...body, slug });
    else await unwrapAction(createCategory)({ ...body, slug: slug.trim() || undefined });
    router.refresh();
  }

  return (
    <FormDialog
      icon={existing ? "✏️" : "🗂️"}
      title={existing ? `Edit ${existing.name}` : defaultParentId ? t("category_form.add_a_subcategory") : t("category_form.add_a_new_category")}
      subtitle={parent ? `Inside ${localizedName(parent, locale)}` : "A main category on the shop home page"}
      saveLabel={existing ? t("category_form.save_changes") : t("category_form.add_category")}
      onClose={onClose}
      onSave={save}
    >
      <DialogSection title="Look" hint="The photo is shown on the shop; the icon is used where there is no photo.">
        <div className="sm:col-span-2 flex flex-col gap-3">
          <ImageUploader value={imageUrl} onChange={setImageUrl} />
          <Field label="Icon" hint="One emoji, for example 🥛 or 🍞. Shown where there is no photo.">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className={`${inputClass} sm:w-32`} maxLength={4} />
          </Field>
        </div>
      </DialogSection>

      <DialogSection title="Name">
        <Field label="Name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Name in Arabic">
          <ArabicInput english={name} value={nameAr} onChange={setNameAr} className={inputClass} compact />
        </Field>
      </DialogSection>

      <DialogSection title="Where it sits">
        <Field label="Inside category" hint="Leave empty for a main category.">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
            <option value="">{t("category_form.no_parent")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {t("category_form.subcategory_of", { name: localizedName(p, locale) })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order" hint="Smaller numbers come first.">
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Web address name (slug)" hint={existing ? "Changing it changes the category's link." : "Made automatically from the name if you leave it empty."} className="sm:col-span-2">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={existing ? undefined : "auto"} className={inputClass} />
        </Field>
      </DialogSection>
    </FormDialog>
  );
}
