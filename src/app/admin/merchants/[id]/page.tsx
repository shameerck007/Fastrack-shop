import Link from "next/link";
import { checkSaudiIban, formatIban } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStoreProducts } from "@/lib/merchant";
import StoreStatusActions from "@/components/admin/StoreStatusActions";
import StoreProfileForm from "@/components/merchant/StoreProfileForm";
import { describeStatus, getOpenStatus } from "@/lib/store-hours";
import { formatSAR } from "@/lib/utils";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

async function signedDocUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("store-documents").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

export default async function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();

  const { data: store } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (!store) notFound();

  const [{ data: owner }, { data: ownerEmail }, products, { count: orderCount }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", store.owner_id).maybeSingle(),
    supabase.rpc("admin_get_user_email", { p_user_id: store.owner_id }),
    getMyStoreProducts(store.id),
    store.warehouse_id
      ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("warehouse_id", store.warehouse_id)
      : Promise.resolve({ count: 0 }),
  ]);

  const [crUrl, vatUrl] = await Promise.all([
    signedDocUrl(supabase, store.cr_document_path),
    signedDocUrl(supabase, store.vat_document_path),
  ]);

  const openInfo =
    store.status === "approved"
      ? describeStatus(getOpenStatus(store.opening_hours ?? null, store.accepting_orders ?? true), locale, t)
      : null;
  const activeCount = products.filter((p) => p.is_active).length;
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;

  return (
    <div>
      <Link href="/admin/merchants" className="text-sm text-blue-600 hover:underline">
        {t("merchant_detail.all_merchants")}
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xl font-bold text-blue-700 ring-1 ring-neutral-200">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
            ) : (
              store.name.trim().charAt(0).toUpperCase()
            )}
          </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{store.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[store.status]}`}>
              {t(`merchants_list.status_${store.status}`)}
            </span>
            {openInfo && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  openInfo.open ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {openInfo.text}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500">
            {t("merchant_detail.joined", {
              city: store.city,
              country: store.country ?? "Saudi Arabia",
              date: new Date(store.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US"),
            })}
          </p>
        </div>
        </div>
        <StoreStatusActions storeId={store.id} status={store.status} />
      </div>

      {store.rejection_reason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <b>{t("merchant_detail.rejection_reason")}</b> {store.rejection_reason}
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{products.length}</p>
          <p className="text-xs text-neutral-500">{t("merchant_detail.products_active", { count: activeCount })}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{orderCount ?? 0}</p>
          <p className="text-xs text-neutral-500">{t("merchant_detail.orders_fulfilled")}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className={`text-2xl font-semibold ${lowStock > 0 ? "text-amber-600" : ""}`}>{lowStock}</p>
          <p className="text-xs text-neutral-500">{t("merchant_detail.low_stock_items")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card title={t("merchant_detail.owner")}>
            <Row label={t("merchant_detail.name")}>{owner?.full_name ?? "—"}</Row>
            <Row label={t("merchant_detail.email")}>{typeof ownerEmail === "string" ? ownerEmail : "—"}</Row>
            {owner?.phone && (
              <Row label={t("merchant_detail.phone")}>
                <a href={`tel:${owner.phone}`} className="text-blue-600 hover:underline">
                  {owner.phone}
                </a>
              </Row>
            )}
          </Card>

          <Card title={t("merchant_detail.business_details")}>
            <Row label={t("merchant_detail.cr_number")}>{store.cr_number}</Row>
            {store.vat_number && <Row label={t("merchant_detail.vat_number")}>{store.vat_number}</Row>}
            {store.contact_phone && <Row label={t("merchant_detail.contact_phone")}>{store.contact_phone}</Row>}
            {store.bank_name && <Row label={t("merchant_detail.bank")}>{store.bank_name}</Row>}
            {store.bank_iban && (
              <Row label={t("merchant_detail.iban")}>
                <span className="font-mono">{formatIban(store.bank_iban)}</span>{" "}
                {checkSaudiIban(store.bank_iban).ok && checkBankDetails(store.bank_name ?? "", store.bank_iban).ok ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Valid</span>
                ) : (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Check IBAN</span>
                )}
              </Row>
            )}
            {store.address_line && (
              <div className="pt-1 text-sm">
                <p className="text-neutral-500">{t("merchant_detail.address")}</p>
                <p>
                  {store.address_line}, {store.city}, {store.country ?? "Saudi Arabia"}
                </p>
              </div>
            )}
          </Card>

          <Card title={t("merchant_detail.documents")}>
            <div className="flex flex-col gap-2 text-sm">
              {crUrl ? (
                <a href={crUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {t("merchant_detail.cr_document")}
                </a>
              ) : (
                <span className="text-neutral-400">{t("merchant_detail.no_cr_document")}</span>
              )}
              {vatUrl ? (
                <a href={vatUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {t("merchant_detail.vat_document")}
                </a>
              ) : (
                <span className="text-neutral-400">{t("merchant_detail.no_vat_document")}</span>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Shop page & opening hours">
            <StoreProfileForm
              storeId={store.id}
              initial={{
                logoUrl: store.logo_url ?? null,
                coverUrl: store.cover_url ?? null,
                tagline: store.tagline ?? null,
                hours: store.opening_hours ?? null,
                acceptingOrders: store.accepting_orders ?? true,
              }}
            />
          </Card>
          <Card title={t("merchant_detail.products_count", { count: products.length })}>
            {products.length === 0 ? (
              <p className="text-sm text-neutral-400">{t("merchant_detail.no_products_listed")}</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {products.map((product) => {
                  const variant = product.product_variants[0];
                  const inv = variant?.inventory[0];
                  return (
                    <div key={product.id} className="flex items-center gap-3 py-2.5">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-lg">📦</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-neutral-400">{variant?.label}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium">{variant ? formatSAR(variant.price) : "—"}</span>
                      <span className="w-16 shrink-0 text-right text-xs text-neutral-500">
                        {inv ? t("merchant_detail.in_stock", { count: inv.stock }) : t("product_card_admin.no_stock_row")}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {product.is_active ? t("product_card_admin.active") : t("product_card_admin.inactive")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
