import { createClient } from "@/lib/supabase/server";
import ListFilter from "@/components/admin/ListFilter";
import { PageHeader } from "@/components/admin/AdminUi";
import CategoryForm from "@/components/admin/CategoryForm";
import CategoryCard from "@/components/admin/CategoryCard";
import type { Category } from "@/types/database";

export const metadata = { title: "Categories" };

function Stat({ icon, label, value, hint, tone = "text-neutral-900" }: { icon: string; label: string; value: number | string; hint?: string; tone?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
        <p className={`text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
        {hint && <p className="truncate text-xs text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories }, countsResult] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    // Products per category: arrives with migration 0091, left blank until then.
    supabase.rpc("category_product_counts" as never),
  ]);
  const all = (categories as Category[]) ?? [];
  const counts: Record<string, number> = {};
  for (const r of ((countsResult.data ?? []) as { category_id: string; products: number }[])) counts[r.category_id] = r.products;

  const topLevel = all.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of all) {
    if (c.parent_id) childrenByParent.set(c.parent_id, [...(childrenByParent.get(c.parent_id) ?? []), c]);
  }
  const subCount = all.length - topLevel.length;
  const withoutLook = all.filter((c) => !c.image_url && !c.icon).length;
  const totalProducts = Object.values(counts).reduce((n, v) => n + v, 0);
  const empty = all.filter((c) => (counts[c.id] ?? 0) === 0 && !childrenByParent.has(c.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon="🗂️"
        title="Categories"
        subtitle="How the shop is organised. Each main category holds its sub-categories; products and commission rates follow them."
        actions={<CategoryForm parentOptions={topLevel} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🗂️" label="Main categories" value={topLevel.length} />
        <Stat icon="📑" label="Sub-categories" value={subCount} />
        <Stat icon="📦" label="Products placed" value={countsResult.error ? "—" : totalProducts} hint={countsResult.error ? "Run migration 0091 to see counts" : `${empty} empty categor${empty === 1 ? "y" : "ies"}`} tone="text-blue-700" />
        <Stat icon="🖼️" label="Without a photo or icon" value={withoutLook} hint={withoutLook === 0 ? "All have a look" : "Shown with a basket"} tone={withoutLook > 0 ? "text-amber-600" : "text-emerald-600"} />
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-4xl">🗂️</p>
          <p className="mt-2 text-sm font-bold text-neutral-800">No categories yet</p>
          <p className="mt-1 text-xs text-neutral-500">Add the first main category, then put sub-categories inside it.</p>
        </div>
      ) : (
        <>
          <ListFilter target="category-list" placeholder="Search categories and sub-categories…" />
          <div id="category-list" className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topLevel.map((category) => (
              <CategoryCard key={category.id} category={category} subs={childrenByParent.get(category.id) ?? []} parentOptions={topLevel} counts={counts} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
