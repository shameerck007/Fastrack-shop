"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCategory(input: {
  name: string;
  nameAr?: string;
  slug?: string;
  icon?: string;
  imageUrl?: string;
  sortOrder?: number;
  parentId?: string | null;
}) {
  const supabase = await createClient();
  if (!input.name.trim()) throw new Error("Category name is required.");

  const { error } = await supabase.from("categories").insert({
    name: input.name.trim(),
    name_ar: input.nameAr?.trim() || null,
    slug: input.slug?.trim() || slugify(input.name),
    icon: input.icon?.trim() || null,
    image_url: input.imageUrl || null,
    sort_order: input.sortOrder ?? 0,
    parent_id: input.parentId || null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with that slug already exists.");
    }
    throw error;
  }
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

export async function updateCategory(
  categoryId: string,
  input: {
    name: string;
    nameAr?: string;
    slug: string;
    icon?: string;
    imageUrl?: string;
    sortOrder?: number;
    parentId?: string | null;
  }
) {
  const supabase = await createClient();
  if (!input.name.trim() || !input.slug.trim()) throw new Error("Name and slug are required.");
  if (input.parentId === categoryId) throw new Error("A category can't be its own parent.");

  // Keep this to two levels (category > subcategory), same as Amazon/Noon —
  // a subcategory can't itself become a parent.
  if (input.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("parent_id")
      .eq("id", input.parentId)
      .maybeSingle();
    if (parent?.parent_id) throw new Error("Can't nest a subcategory under another subcategory.");
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name.trim(),
      name_ar: input.nameAr?.trim() || null,
      slug: input.slug.trim(),
      icon: input.icon?.trim() || null,
      image_url: input.imageUrl || null,
      sort_order: input.sortOrder ?? 0,
      parent_id: input.parentId || null,
    })
    .eq("id", categoryId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with that slug already exists.");
    }
    throw error;
  }
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient();
  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", categoryId);
  if (childCount && childCount > 0) {
    throw new Error("This category still has subcategories — move or delete those first.");
  }

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("This category still has products assigned to it — move or delete those first.");
    }
    throw error;
  }
  revalidatePath("/admin/categories");
  revalidatePath("/");
}
