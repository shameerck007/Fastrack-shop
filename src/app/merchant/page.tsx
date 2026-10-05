import LandingPreferenceCard from "@/components/LandingPreferenceCard";
import Link from "next/link";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";
import { updateMerchantProductStock } from "@/lib/actions/merchant-products";
import StockCell from "@/components/admin/StockCell";
import StoreProfileForm from "@/components/merchant/StoreProfileForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName } from "@/lib/i18n/localized";

export default async function MerchantDashboardPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) return null;

  const products = await getMyStoreProducts(store.id);
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;
  const activeCount = products.filter((p) => p.is_active).length;

  const stats = [
    { label: t("merchant.products"), value: products.length, icon: "📦", color: "bg-blue-50 text-blue-700", href: "/merchant/products" },
    { label: t("merchant.low_stock"), value: lowStock, icon: "⚠️", color: lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-neutral-50 text-neutral-500", href: "/merchant/products" },
    { label: t("merchant.active"), value: activeCount, icon: "✅", color: "bg-emerald-50 text-emerald-700", href: "/merchant/products" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{t("merchant.welcome_back", { name: store.name })}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("merchant.storefront_intro")}</p>

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
          {t("merchant.manage_products")}
        </Link>
      </div>

      {products.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{t("merchant.stock_overview")}</p>
            <Link href="/merchant/products" className="text-xs text-blue-600 hover:underline">
              {t("merchant.manage_products")}
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-neutral-100">
            {products.map((product) => {
              const variant = product.product_variants[0];
              const inv = variant?.inventory[0];
              const name = localizedName(product, locale);
              return (
                <div key={product.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm">📦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
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
                    <span className="text-xs text-neutral-400">{t("merchant.no_stock_row")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <StoreProfileForm
        initial={{
          logoUrl: store.logo_url ?? null,
          coverUrl: store.cover_url ?? null,
          tagline: store.tagline ?? null,
          hours: store.opening_hours ?? null,
          acceptingOrders: store.accepting_orders ?? true,
        }}
      />

      {store.status === "approved" && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium">{t("merchant.store_qr_code")}</p>
          <p className="mb-3 text-xs text-neutral-500">{t("merchant.qr_intro")}</p>
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
                {t("merchant.view_public_storefront")}
              </Link>
              <a
                href={`/api/stores/${store.id}/qr`}
                download={`${store.name}-qr-code.png`}
                className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
              >
                {t("merchant.download_qr")}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <p className="mb-3 font-medium">{t("merchant.store_details")}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-400">{t("merchant.cr_number")}</dt>
            <dd className="text-neutral-700">{store.cr_number}</dd>
          </div>
          {store.vat_number && (
            <div>
              <dt className="text-xs text-neutral-400">{t("merchant.vat_number")}</dt>
              <dd className="text-neutral-700">{store.vat_number}</dd>
            </div>
          )}
          {store.contact_phone && (
            <div>
              <dt className="text-xs text-neutral-400">{t("merchant.contact_phone")}</dt>
              <dd className="text-neutral-700">{store.contact_phone}</dd>
            </div>
          )}
          {store.address_line && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-400">{t("merchant.pickup_address")}</dt>
              <dd className="text-neutral-700">
                {store.address_line}
                {store.city ? `, ${store.city}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="mt-6">
        <LandingPreferenceCard />
      </div>
    </div>
  );
}
