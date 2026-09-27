import { createClient } from "@/lib/supabase/server";
import CategoryForm from "@/components/admin/CategoryForm";
import CategoryRow from "@/components/admin/CategoryRow";
import type { Category } from "@/types/database";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  const all = (categories as Category[]) ?? [];

  const topLevel = all.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of all) {
    if (c.parent_id) childrenByParent.set(c.parent_id, [...(childrenByParent.get(c.parent_id) ?? []), c]);
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Categories</h1>
          <p className="text-sm text-neutral-500">
            {all.length} categor{all.length === 1 ? "y" : "ies"} — controls what shows in &quot;Shop by category&quot;
            and category pages. Add subcategories (e.g. Grocery → Rice &amp; Grains) to organize a busy category, like
            Amazon or Noon.
          </p>
        </div>
        <CategoryForm parentOptions={topLevel} />
      </div>

      <div className="flex flex-col gap-3">
        {topLevel.map((category) => {
          const children = childrenByParent.get(category.id) ?? [];
          return (
            <div key={category.id} className="flex flex-col gap-2">
              <CategoryRow category={category} parentOptions={topLevel} />
              {children.map((child) => (
                <CategoryRow key={child.id} category={child} parentOptions={topLevel} indent />
              ))}
              <div className="ml-8">
                <CategoryForm parentOptions={topLevel} defaultParentId={category.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
