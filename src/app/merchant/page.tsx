import Link from "next/link";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";

export default async function MerchantDashboardPage() {
  const store = await getMyStore();
  if (!store) return null;

  const products = await getMyStoreProducts(store.id);
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;
  const activeCount = products.filter((p) => p.is_active).length;

  const stats = [
    { label: "Products", value: products.length, icon: "📦", color: "bg-blue-50 text-blue-700" },
    { label: "Low stock", value: lowStock, icon: "⚠️", color: lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-neutral-50 text-neutral-500" },
    { label: "Active", value: activeCount, icon: "✅", color: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Welcome back, {store.name}</h1>
      <p className="mb-6 text-sm text-neutral-500">Here&apos;s how your storefront is doing.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${s.color}`}>
                {s.icon}
              </span>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Link
          href="/merchant/products"
          className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Manage products →
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <p className="mb-3 font-medium">Store details</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-400">CR number</dt>
            <dd className="text-neutral-700">{store.cr_number}</dd>
          </div>
          {store.vat_number && (
            <div>
              <dt className="text-xs text-neutral-400">VAT number</dt>
              <dd className="text-neutral-700">{store.vat_number}</dd>
            </div>
          )}
          {store.contact_phone && (
            <div>
              <dt className="text-xs text-neutral-400">Contact phone</dt>
              <dd className="text-neutral-700">{store.contact_phone}</dd>
            </div>
          )}
          {store.address_line && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-400">Pickup address</dt>
              <dd className="text-neutral-700">
                {store.address_line}
                {store.city ? `, ${store.city}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
