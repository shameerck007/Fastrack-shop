import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ApiKeysCard, { type KeyRow } from "@/components/merchant/ApiKeysCard";
import ProductImport from "@/components/merchant/ProductImport";

export const metadata = { title: "Import & API" };

const sample = (base: string) => `# List your products
curl -H "Authorization: Bearer ftk_YOUR_KEY" "${base}/api/v1/products?page=1&size=50"

# Create or update products (up to 100 items per call)
curl -X POST -H "Authorization: Bearer ftk_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"RICE-5KG","name":"Basmati Rice","category":"grocery","variant_label":"5 kg","unit":"kg","quantity":5,"price":45,"stock":120}]}' \\
  ${base}/api/v1/products

# Update only price and stock of products that already exist
curl -X PATCH -H "Authorization: Bearer ftk_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"RICE-5KG","variant_label":"5 kg","stock":97,"price":46}]}' \\
  ${base}/api/v1/inventory

# Orders that contain your items
curl -H "Authorization: Bearer ftk_YOUR_KEY" "${base}/api/v1/orders?since=2026-01-01&status=confirmed"`;

const FIELDS: [string, string][] = [
  ["sku", "Your own product code. Required. Rows with the same sku are packs of one product."],
  ["name, name_ar, brand, description, image_url (https)", "Product details. name and category are required for a new product. Products from the shared catalog keep their shared details."],
  ["category", "A category name or slug from the shop, for example grocery."],
  ["variant_label", "The pack, for example 1 kg or 500 g. Default: 1 unit. Identifies the pack within the sku."],
  ["unit, quantity", "For example kg and 5."],
  ["price", "Selling price, above 0. Required for a new pack."],
  ["compare_at_price, compare_at_until", "Old price shown crossed out (must be higher than price) and the last day of the offer, like 2026-12-31."],
  ["stock", "Units in stock, 0 or more. Required for a new pack."],
  ["tax_rate, active", "Tax percent, and yes or no to show or hide the product."],
];

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("supplier_api_keys" as never).select("id, name, key_prefix, created_at, last_used_at, revoked_at").order("created_at", { ascending: false });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "shop.fastrack.cloud";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Import &amp; API</h1>
        <p className="mt-1 text-sm text-neutral-500">Put many products on FasTrack at once, or connect your own system so price and stock stay in step.</p>
      </div>

      <ProductImport />
      <ApiKeysCard keys={(data ?? []) as unknown as KeyRow[]} />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">API guide</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Send your key as <code className="rounded bg-neutral-100 px-1">Authorization: Bearer ftk_…</code>. Bodies are JSON. Each call handles up to 100 items, and each key can make 60 calls a minute. Every item is checked on its own, and the answer says what
          happened to each one (created, updated, unchanged or the problem).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{sample(base)}</pre>
        <h3 className="mt-5 text-sm font-semibold">Fields (CSV columns and API item fields are the same)</h3>
        <dl className="mt-2 divide-y divide-neutral-100 text-sm">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
              <dt className="font-mono text-xs text-neutral-800">{k}</dt>
              <dd className="text-neutral-600">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
