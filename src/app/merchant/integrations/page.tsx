import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ApiKeysCard, { type KeyRow } from "@/components/merchant/ApiKeysCard";
import ProductImport from "@/components/merchant/ProductImport";
import WebhookCard, { type WebhookEventRow, type WebhookSettings } from "@/components/merchant/WebhookCard";

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

const webhookSample = `POST https://your-system.com/fastrack
x-fastrack-event: order.created
x-fastrack-delivery: 6f1c...            (the message id)
x-fastrack-timestamp: 1790000000
x-fastrack-signature: sha256=9a3b...    (HMAC-SHA256 of "<timestamp>.<body>" with your secret)

{"id":"6f1c...","event":"order.created","created_at":"2026-10-13T08:11:00Z",
 "data":{"order_number":"FT14335","status":"confirmed","placed_at":"2026-10-13T08:10:40Z","currency":"SAR",
         "items":[{"sku":"RICE-5KG","name":"Basmati Rice","variant_label":"5 kg","quantity":2,"unit_price":46,"line_total":92}]}}

// Check it in Node.js
const expected = "sha256=" + crypto.createHmac("sha256", SECRET).update(timestamp + "." + rawBody).digest("hex");
if (expected !== signatureHeader) return res.status(401).end();   // also reject old timestamps (over 5 minutes)`;

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
  const { data: wh } = await supabase.from("supplier_webhooks" as never).select("url, secret, enabled").maybeSingle();
  const { data: evs } = await supabase.from("supplier_webhook_events" as never).select("id, event, status, attempts, last_status, last_error, created_at, orders(order_number)").order("created_at", { ascending: false }).limit(15);
  const events = ((evs ?? []) as unknown as (Omit<WebhookEventRow, "order_number"> & { orders: { order_number: string } | null })[]).map((e) => ({ ...e, order_number: e.orders?.order_number ?? null }));
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
      <WebhookCard webhook={(wh as WebhookSettings | null) ?? null} events={events} />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">API guide</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Send your key as <code className="rounded bg-neutral-100 px-1">Authorization: Bearer ftk_…</code>. Bodies are JSON. Each call handles up to 100 items, and each key can make 60 calls a minute. Every item is checked on its own, and the answer says what
          happened to each one (created, updated, unchanged or the problem).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{sample(base)}</pre>

        <h3 className="mt-5 text-sm font-semibold">Webhook messages</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Events: <code className="rounded bg-neutral-100 px-1">order.created</code>, <code className="rounded bg-neutral-100 px-1">order.picked_up</code>, <code className="rounded bg-neutral-100 px-1">order.delivered</code>,{" "}
          <code className="rounded bg-neutral-100 px-1">order.cancelled</code>, <code className="rounded bg-neutral-100 px-1">return.requested</code>. Each is a POST with a JSON body that lists only your items. Answer with any 2xx within 8 seconds. If you do not, FasTrack tries again after
          1 minute, 10 minutes, 1 hour and 6 hours, then gives up. The same message can arrive twice, so use the <code className="rounded bg-neutral-100 px-1">id</code> to ignore repeats.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{webhookSample}</pre>
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
