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
  sortOrder?: number;
}) {
  const supabase = await createClient();
  if (!input.name.trim()) throw new Error("Category name is required.");

  const { error } = await supabase.from("categories").insert({
    name: input.name.trim(),
    name_ar: input.nameAr?.trim() || null,
    slug: input.slug?.trim() || slugify(input.name),
    icon: input.icon?.trim() || null,
    sort_order: input.sortOrder ?? 0,
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
  input: { name: string; nameAr?: string; slug: string; icon?: string; sortOrder?: number }
) {
  const supabase = await createClient();
  if (!input.name.trim() || !input.slug.trim()) throw new Error("Name and slug are required.");

  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name.trim(),
      name_ar: input.nameAr?.trim() || null,
      slug: input.slug.trim(),
      icon: input.icon?.trim() || null,
      sort_order: input.sortOrder ?? 0,
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
