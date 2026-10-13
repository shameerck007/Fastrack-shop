import { createClient } from "@/lib/supabase/server";
import ListFilter from "@/components/admin/ListFilter";
import { PageHeader } from "@/components/admin/AdminUi";
import CategoryForm from "@/components/admin/CategoryForm";
import CategoryTile from "@/components/admin/CategoryTile";
import type { Category } from "@/types/database";

export const metadata = { title: "Categories" };

function Pill({ icon, label, value, tone = "text-neutral-900" }: { icon: string; label: string; value: number | string; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3.5 py-1.5 text-xs text-neutral-600 shadow-sm backdrop-blur">
      <span aria-hidden>{icon}</span>
      {label} <b className={`text-sm ${tone}`}>{value}</b>
    </span>
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
  const withoutLook = all.filter((c) => !c.image_url && !c.icon).length;
  const totalProducts = Object.values(counts).reduce((n, v) => n + v, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🗂️" title="Categories" subtitle="Click a category to see and change its sub-categories." actions={<CategoryForm parentOptions={topLevel} />} />

      <section className="relative overflow-hidden rounded-[2rem] p-3 sm:p-5" style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #eef2ff 45%, #f1f5f9 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-sky-200/60 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon="🗂️" label="Main" value={topLevel.length} />
            <Pill icon="📑" label="Sub" value={all.length - topLevel.length} />
            <Pill icon="📦" label="Products" value={countsResult.error ? "—" : totalProducts} tone="text-brand-700" />
            {withoutLook > 0 && <Pill icon="🖼️" label="No photo or icon" value={withoutLook} tone="text-amber-600" />}
          </div>

          {all.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white bg-white/50 p-10 text-center backdrop-blur">
              <p className="text-4xl">🗂️</p>
              <p className="mt-2 text-sm font-bold text-neutral-800">No categories yet</p>
              <p className="mt-1 text-xs text-neutral-500">Add the first main category, then put sub-categories inside it.</p>
            </div>
          ) : (
            <>
              <ListFilter target="category-list" placeholder="Search categories and sub-categories…" />
              <div id="category-list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {topLevel.map((category) => (
                  <CategoryTile key={category.id} category={category} subs={childrenByParent.get(category.id) ?? []} parentOptions={topLevel} counts={counts} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
