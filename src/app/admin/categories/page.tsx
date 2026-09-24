import { createClient } from "@/lib/supabase/server";
import CategoryForm from "@/components/admin/CategoryForm";
import CategoryRow from "@/components/admin/CategoryRow";
import type { Category } from "@/types/database";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  const categoryList = (categories as Category[]) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-neutral-500">
          {categoryList.length} categor{categoryList.length === 1 ? "y" : "ies"} — controls what shows in &quot;Shop by
          category&quot; and category pages.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Add a new category</h2>
        <CategoryForm />
      </div>

      <div className="flex flex-col gap-2">
        {categoryList.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
