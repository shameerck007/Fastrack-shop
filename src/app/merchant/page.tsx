import { getMyStore, getMyStoreProducts } from "@/lib/merchant";

export default async function MerchantDashboardPage() {
  const store = await getMyStore();
  if (!store) return null;

  const products = await getMyStoreProducts(store.id);
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;

  const stats = [
    { label: "Products", value: products.length },
    { label: "Low stock", value: lowStock },
    { label: "Active", value: products.filter((p) => p.is_active).length },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <p className="mb-2 font-medium">Store details</p>
        <dl className="grid grid-cols-2 gap-y-1 text-neutral-600">
          <dt>CR number</dt>
          <dd>{store.cr_number}</dd>
          {store.vat_number && (
            <>
              <dt>VAT number</dt>
              <dd>{store.vat_number}</dd>
            </>
          )}
          {store.address_line && (
            <>
              <dt>Pickup address</dt>
              <dd>{store.address_line}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
