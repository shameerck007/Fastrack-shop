import Link from "next/link";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";
import { updateMerchantProductStock } from "@/lib/actions/merchant-products";
import StockCell from "@/components/admin/StockCell";

export default async function MerchantDashboardPage() {
  const store = await getMyStore();
  if (!store) return null;

  const products = await getMyStoreProducts(store.id);
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;
  const activeCount = products.filter((p) => p.is_active).length;

  const stats = [
    { label: "Products", value: products.length, icon: "📦", color: "bg-blue-50 text-blue-700", href: "/merchant/products" },
    { label: "Low stock", value: lowStock, icon: "⚠️", color: lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-neutral-50 text-neutral-500", href: "/merchant/products" },
    { label: "Active", value: activeCount, icon: "✅", color: "bg-emerald-50 text-emerald-700", href: "/merchant/products" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Welcome back, {store.name}</h1>
      <p className="mb-6 text-sm text-neutral-500">Here&apos;s how your storefront is doing.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${s.color}`}>
                {s.icon}
              </span>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          </Link>
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

      {products.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Stock overview</p>
            <Link href="/merchant/products" className="text-xs text-blue-600 hover:underline">
              Manage products →
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-neutral-100">
            {products.map((product) => {
              const variant = product.product_variants[0];
              const inv = variant?.inventory[0];
              return (
                <div key={product.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm">📦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-neutral-400">{variant?.label}</p>
                    </div>
                  </div>
                  {inv ? (
                    <StockCell
                      inventoryId={inv.id}
                      stock={inv.stock}
                      minStock={inv.min_stock}
                      updateAction={updateMerchantProductStock}
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">No stock row</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {store.status === "approved" && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium">Your store QR code</p>
          <p className="mb-3 text-xs text-neutral-500">
            Print this and display it in your shop — customers scan it to open your storefront
            in the app and order directly from you.
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/stores/${store.id}/qr`}
              alt={`QR code linking to ${store.name}'s storefront`}
              width={160}
              height={160}
              className="rounded-lg border border-neutral-200"
            />
            <div className="flex flex-col gap-2 text-sm">
              <Link href={`/store/${store.id}`} className="text-blue-600 hover:underline">
                View your public storefront →
              </Link>
              <a
                href={`/api/stores/${store.id}/qr`}
                download={`${store.name}-qr-code.png`}
                className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
              >
                Download QR code
              </a>
            </div>
          </div>
        </div>
      )}

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
