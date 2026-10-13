import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ApiKeysCard, { type KeyRow } from "@/components/merchant/ApiKeysCard";
import ProductImport from "@/components/merchant/ProductImport";
import WebhookCard, { type WebhookEventRow, type WebhookSettings } from "@/components/merchant/WebhookCard";
import IntegrationsTabs from "@/components/merchant/IntegrationsTabs";
import { PRODUCT_COLUMNS } from "@/lib/product-template";

export const metadata = { title: "Import & API" };

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/v1/products", "List your products with packs, prices and stock (page, size up to 100)."],
  ["POST", "/api/v1/products", "Create or update products. Up to 100 items per call."],
  ["PATCH", "/api/v1/inventory", "Update price and stock of products that already exist. Never creates."],
  ["GET", "/api/v1/catalog", "Check if a barcode is in the FasTrack catalog (?barcode=…). If it is, you only send price and stock for it."],
  ["GET", "/api/v1/orders", "Orders that contain your items (since, status, limit)."],
];

const EVENTS: [string, string][] = [
  ["order.created", "A customer placed an order with your items."],
  ["order.picked_up", "The rider collected it and is on the way."],
  ["order.delivered", "It reached the customer."],
  ["order.cancelled", "The order was cancelled."],
  ["return.requested", "A customer asked to return one of your items."],
];

const curl = (base: string) => `# List your products
curl -H "Authorization: Bearer ftk_YOUR_KEY" "${base}/api/v1/products?page=1&size=50"

# Create or update products
curl -X POST -H "Authorization: Bearer ftk_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"RICE-5KG","name":"Basmati Rice","category":"grocery","variant_label":"5 kg","unit":"kg","quantity":5,"price":45,"stock":120}]}' \\
  ${base}/api/v1/products

# Update only price and stock
curl -X PATCH -H "Authorization: Bearer ftk_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"RICE-5KG","variant_label":"5 kg","stock":97,"price":46}]}' \\
  ${base}/api/v1/inventory

# Is this barcode in the catalog?
curl -H "Authorization: Bearer ftk_YOUR_KEY" "${base}/api/v1/catalog?barcode=3057640379048"

# Sell a catalog product: just the barcode, your price and stock
curl -X POST -H "Authorization: Bearer ftk_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"items":[{"barcode":"3057640379048","price":6,"stock":20}]}' \
  ${base}/api/v1/products

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 text-sm text-neutral-600">{children}</div>
    </section>
  );
}

const code = "rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px] text-neutral-800";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: keyRows } = await supabase.from("supplier_api_keys" as never).select("id, name, key_prefix, created_at, last_used_at, revoked_at").order("created_at", { ascending: false });
  const { data: wh } = await supabase.from("supplier_webhooks" as never).select("url, secret, enabled").maybeSingle();
  const { data: evs } = await supabase.from("supplier_webhook_events" as never).select("id, event, status, attempts, last_status, last_error, created_at, orders(order_number)").order("created_at", { ascending: false }).limit(15);
  const events = ((evs ?? []) as unknown as (Omit<WebhookEventRow, "order_number"> & { orders: { order_number: string } | null })[]).map((e) => ({ ...e, order_number: e.orders?.order_number ?? null }));
  const keys = (keyRows ?? []) as unknown as KeyRow[];
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "shop.fastrack.cloud";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const activeKeys = keys.filter((k) => !k.revoked_at).length;

  const guide = (
    <div className="flex flex-col gap-4">
      <Section title="Before you start">
        <p>
          Make a key in the <b>API keys</b> tab and send it with every call as <code className={code}>Authorization: Bearer ftk_…</code>. Bodies are JSON. A key only ever reaches your own store. Each call handles up to 100 items and each key can make 60 calls a minute. Every
          item is checked on its own, and the answer says what happened to each one: created, updated, unchanged, or what the problem was.
        </p>
      </Section>

      <Section title="Endpoints">
        <ul className="divide-y divide-neutral-100">
          {ENDPOINTS.map(([m, p, d]) => (
            <li key={m + p} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="flex shrink-0 items-center gap-2 sm:w-64">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${m === "GET" ? "bg-emerald-50 text-emerald-700" : m === "POST" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{m}</span>
                <code className="font-mono text-xs text-neutral-900">{p}</code>
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{curl(base)}</pre>
      </Section>

      <Section title="Product fields">
        <p className="mb-2">The Excel template columns and the API item fields are the same.</p>
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Needed</th>
                <th className="px-3 py-2">What to send</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_COLUMNS.map((c) => (
                <tr key={c.key} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2 font-mono text-neutral-900">{c.key}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.required}</td>
                  <td className="px-3 py-2">{c.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Webhook messages">
        <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
          {EVENTS.map(([e, d]) => (
            <li key={e} className="flex items-baseline gap-2">
              <code className={code}>{e}</code>
              <span className="text-xs">{d}</span>
            </li>
          ))}
        </ul>
        <p>
          Each message is a POST with a JSON body that lists only your items. Answer with any 2xx within 8 seconds. If you do not, FasTrack tries again after 1 minute, 10 minutes, 1 hour and 6 hours, then gives up. The same message can arrive twice, so use its{" "}
          <code className={code}>id</code> to ignore repeats.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{webhookSample}</pre>
      </Section>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl" aria-hidden>🔌</span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Import &amp; API</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100">Put many products on FasTrack at once, keep price and stock in step with your own system, and get new orders the moment they are placed.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-3 py-1">{activeKeys} active API key{activeKeys === 1 ? "" : "s"}</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Webhook {wh && (wh as WebhookSettings).enabled ? "on" : "off"}</span>
        </div>
      </header>

      <IntegrationsTabs
        tabs={[
          { id: "excel", label: "Excel upload", icon: "📊", hint: "Many products at once", content: <ProductImport /> },
          { id: "api", label: "API keys", icon: "🔑", hint: "Connect your system", content: <ApiKeysCard keys={keys} /> },
          { id: "webhook", label: "Webhook", icon: "🔔", hint: "Orders sent to you", content: <WebhookCard webhook={(wh as WebhookSettings | null) ?? null} events={events} /> },
          { id: "guide", label: "Developer guide", icon: "📘", hint: "Endpoints and examples", content: guide },
        ]}
      />
    </div>
  );
}
