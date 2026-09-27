import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStoreProducts } from "@/lib/merchant";
import StoreStatusActions from "@/components/admin/StoreStatusActions";
import { formatSAR } from "@/lib/utils";

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

  const activeCount = products.filter((p) => p.is_active).length;
  const lowStock = products.filter((p) =>
    p.product_variants.some((v) => v.inventory.some((i) => i.stock < i.min_stock))
  ).length;

  return (
    <div>
      <Link href="/admin/merchants" className="text-sm text-blue-600 hover:underline">
        ← All merchants
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{store.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[store.status]}`}>
              {store.status}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            {store.city}, {store.country ?? "Saudi Arabia"} · Joined {new Date(store.created_at).toLocaleDateString()}
          </p>
        </div>
        <StoreStatusActions storeId={store.id} status={store.status} />
      </div>

      {store.rejection_reason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <b>Rejection reason:</b> {store.rejection_reason}
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{products.length}</p>
          <p className="text-xs text-neutral-500">Products ({activeCount} active)</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{orderCount ?? 0}</p>
          <p className="text-xs text-neutral-500">Orders fulfilled</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className={`text-2xl font-semibold ${lowStock > 0 ? "text-amber-600" : ""}`}>{lowStock}</p>
          <p className="text-xs text-neutral-500">Low stock items</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card title="Owner">
            <Row label="Name">{owner?.full_name ?? "—"}</Row>
            <Row label="Email">{typeof ownerEmail === "string" ? ownerEmail : "—"}</Row>
            {owner?.phone && (
              <Row label="Phone">
                <a href={`tel:${owner.phone}`} className="text-blue-600 hover:underline">
                  {owner.phone}
                </a>
              </Row>
            )}
          </Card>

          <Card title="Business details">
            <Row label="CR number">{store.cr_number}</Row>
            {store.vat_number && <Row label="VAT number">{store.vat_number}</Row>}
            {store.contact_phone && <Row label="Contact phone">{store.contact_phone}</Row>}
            {store.bank_name && <Row label="Bank">{store.bank_name}</Row>}
            {store.bank_iban && <Row label="IBAN">{store.bank_iban}</Row>}
            {store.address_line && (
              <div className="pt-1 text-sm">
                <p className="text-neutral-500">Address</p>
                <p>
                  {store.address_line}, {store.city}, {store.country ?? "Saudi Arabia"}
                </p>
              </div>
            )}
          </Card>

          <Card title="Documents">
            <div className="flex flex-col gap-2 text-sm">
              {crUrl ? (
                <a href={crUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  📄 CR document
                </a>
              ) : (
                <span className="text-neutral-400">No CR document uploaded</span>
              )}
              {vatUrl ? (
                <a href={vatUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  📄 VAT document
                </a>
              ) : (
                <span className="text-neutral-400">No VAT document uploaded</span>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={`Products (${products.length})`}>
            {products.length === 0 ? (
              <p className="text-sm text-neutral-400">No products listed yet.</p>
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
                        {inv ? `${inv.stock} in stock` : "no stock row"}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {product.is_active ? "Active" : "Inactive"}
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
