import { createClient } from "@/lib/supabase/server";
import { moneyFor } from "@/lib/money";
import { marketOffsetMinutes } from "@/lib/timezone";
import { sendEmail } from "@/lib/email";
import {
  renderEmailShell,
  renderInfoGrid,
  renderOrderItemsTable,
  renderSummaryTable,
  renderBoxSection,
  esc,
  type EmailLineItem,
} from "@/lib/email-template";
import type { DeliveryType, OrderStatus } from "@/types/database";

const SITE_URL = "https://shop.fastrack.cloud";

async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_emails_for", { target_user_ids: ids });
  return new Map(((data ?? []) as { user_id: string; email: string }[]).map((r) => [r.user_id, r.email]));
}

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The delivery line of an email: the time promised when the order was placed (saved on the order), in the market's own clock.
 * Without a saved promise we say the time will be confirmed, never an invented range. */
function estimateArrival(order: {
  delivery_type: DeliveryType;
  scheduled_for: string | null;
  estimated_delivery_at?: string | null;
  promised_eta_minutes?: number | null;
  country_code?: string | null;
}): string {
  const offset = marketOffsetMinutes(order.country_code);
  const inMarket = (iso: string) => new Date(new Date(iso).getTime() + offset * 60_000);
  if (order.delivery_type === "scheduled" && order.scheduled_for) {
    return inMarket(order.scheduled_for).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  }
  if (order.delivery_type === "express") {
    if (order.estimated_delivery_at && order.promised_eta_minutes) {
      const at = inMarket(order.estimated_delivery_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
      return `About ${order.promised_eta_minutes} min (around ${at})`;
    }
    return "Today. We will confirm the time once the shop accepts your order";
  }
  if (order.estimated_delivery_at) {
    return `Expected ${inMarket(order.estimated_delivery_at).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
  }
  return "We will confirm your delivery date";
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  mada: "mada card",
  visa: "Visa card",
  mastercard: "Mastercard",
  apple_pay: "Apple Pay",
};

type OrderItemRow = {
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  line_total: number;
  product_variants: { products: { image_url: string | null } | null } | null;
};

type AddressRow = {
  address_line: string;
  city: string;
  district: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
} | null;

const FULL_ORDER_FIELDS =
  "id, order_number, user_id, subtotal, delivery_fee, total, currency, created_at, delivery_type, scheduled_for, addresses(address_line, city, district, receiver_name, receiver_phone), order_items(product_name, variant_label, ordered_quantity, line_total, product_variants!variant_id(products(image_url))), payments(method), profiles(full_name)";
// Promised delivery time (migration 0072); the email still works before that is applied.
const FULL_ORDER_SELECT = FULL_ORDER_FIELDS + ", country_code, promised_eta_minutes, estimated_delivery_at";

interface OrderEmailRow {
  id: string;
  order_number: string;
  user_id: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string | null;
  created_at: string;
  delivery_type: DeliveryType;
  scheduled_for: string | null;
  country_code?: string | null;
  promised_eta_minutes?: number | null;
  estimated_delivery_at?: string | null;
  addresses: unknown;
  order_items: unknown;
  payments: unknown;
  profiles: unknown;
}

interface FullOrderEmailData {
  to: string;
  orderId: string;
  orderNumber: string;
  firstName: string;
  detailsHtml: string;
}

/** Fetches everything an Amazon-style order email needs — items, shipping
 * address, payment method, totals — and renders the shared detail blocks
 * (info grid, itemized table, summary, address/payment boxes) once, so
 * every email about a specific order (confirmed, delivered, cancelled)
 * shows the exact same full picture instead of some being a thin recap. */
async function loadFullOrderEmailData(orderId: string): Promise<FullOrderEmailData | null> {
  const supabase = await createClient();
  let order = ((await supabase.from("orders").select(FULL_ORDER_SELECT).eq("id", orderId).maybeSingle()).data ?? null) as unknown as OrderEmailRow | null;
  if (!order) order = ((await supabase.from("orders").select(FULL_ORDER_FIELDS).eq("id", orderId).maybeSingle()).data ?? null) as unknown as OrderEmailRow | null;
  if (!order) return null;
  const money = moneyFor((order as unknown as { currency?: string }).currency ?? "SAR");

  const emails = await emailsFor([order.user_id]);
  const to = emails.get(order.user_id);
  if (!to) return null;

  const items: EmailLineItem[] = ((order.order_items ?? []) as unknown as OrderItemRow[]).map((i) => ({
    name: i.product_name,
    variant: i.variant_label,
    quantity: i.ordered_quantity,
    lineTotalFormatted: money(Number(i.line_total)),
    imageUrl: i.product_variants?.products?.image_url ?? null,
  }));

  const address = order.addresses as unknown as AddressRow;
  const profile = order.profiles as unknown as { full_name: string | null } | null;
  const payments = order.payments as unknown as { method: string }[] | null;
  const paymentMethod = PAYMENT_METHOD_LABEL[payments?.[0]?.method ?? "cash_on_delivery"] ?? "Cash on Delivery";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const detailsHtml = `
    ${renderInfoGrid([
      { label: "Order #", value: order.order_number },
      { label: "Order date", value: formatOrderDate(order.created_at) },
      { label: "Order total", value: money(order.total) },
      { label: "Delivery", value: estimateArrival(order) },
    ])}
    <p style="margin:24px 0 8px;font-weight:700;color:#111111;font-size:15px;">Items in this order</p>
    ${renderOrderItemsTable(items)}
    <div style="margin-top:16px;max-width:260px;margin-inline-start:auto;">
      ${renderSummaryTable([
        { label: "Item(s) subtotal", value: money(order.subtotal) },
        { label: "Delivery", value: order.delivery_fee > 0 ? money(order.delivery_fee) : "Free" },
        { label: "Order total", value: money(order.total), bold: true },
      ])}
    </div>
    ${
      address
        ? renderBoxSection(
            "Shipping address",
            `${address.receiver_name ?? ""}<br/>${address.address_line}${address.district ? `, ${address.district}` : ""}<br/>${address.city}${address.receiver_phone ? `<br/>${address.receiver_phone}` : ""}`
          )
        : ""
    }
    ${renderBoxSection("Payment method", paymentMethod)}
  `;

  return { to, orderId: order.id, orderNumber: order.order_number, firstName, detailsHtml };
}

/** The rich, itemized Amazon/Noon-style confirmation — sent once, right
 * after placeOrder() creates the order. */
export async function sendOrderConfirmationEmail(orderId: string) {
  const data = await loadFullOrderEmailData(orderId);
  if (!data) return;

  const bodyHtml = `
    <p>Hi ${data.firstName},</p>
    <p>Thanks for your order! We'll email you again as soon as it's on its way.</p>
    ${data.detailsHtml}
  `;

  await sendEmail({
    to: data.to,
    subject: `Ordered: your FasTrack order #${data.orderNumber}`,
    html: renderEmailShell({
      preheader: `Order #${data.orderNumber} confirmed.`,
      heading: "Order confirmed",
      bodyHtml,
      ctaLabel: "View order details",
      ctaUrl: `${SITE_URL}/orders/${data.orderId}`,
    }),
  });
}

// Only the two closing milestones get an email — every in-between step
// (confirmed, preparing, ready for pickup, rider assigned, out for
// delivery) still fires push + the in-app bell, just not an inbox
// message. Quick-commerce orders move through those in minutes; emailing
// each one is the kind of over-notification real Amazon/Noon avoid too.
const STATUS_EMAIL: Partial<Record<OrderStatus, { subject: string; heading: string; body: string }>> = {
  delivered: {
    subject: "Your order has been delivered — #{n}",
    heading: "Delivered",
    body: "Order #{n} has been delivered. Enjoy!",
  },
  cancelled: {
    subject: "Your order was cancelled — #{n}",
    heading: "Order cancelled",
    body: "Order #{n} has been cancelled.",
  },
};

/** Same full order picture as the confirmation email (items, address,
 * payment method) — not just a status recap — so delivered/cancelled
 * reads as a complete record on its own, same transparency as the
 * order-placed email. Only fires for delivered/cancelled — see
 * STATUS_EMAIL above. */
export async function sendOrderStatusEmail(orderId: string, status: OrderStatus) {
  const template = STATUS_EMAIL[status];
  if (!template) return;

  const data = await loadFullOrderEmailData(orderId);
  if (!data) return;

  const n = data.orderNumber;
  const bodyHtml = `
    <p>Hi ${data.firstName},</p>
    <p>${template.body.replace("{n}", n)}</p>
    ${data.detailsHtml}
  `;

  await sendEmail({
    to: data.to,
    subject: template.subject.replace("{n}", n),
    html: renderEmailShell({
      preheader: template.body.replace("{n}", n),
      heading: template.heading,
      bodyHtml,
      ctaLabel: "View order details",
      ctaUrl: `${SITE_URL}/orders/${data.orderId}`,
    }),
  });
}

/** Sent when admin marks an order's payment as refunded. */
export async function sendRefundEmail(orderId: string, reason: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, order_number, total, currency, profiles(full_name), payments(amount)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  const money = moneyFor((order as unknown as { currency?: string }).currency ?? "SAR");

  const emails = await emailsFor([order.user_id]);
  const to = emails.get(order.user_id);
  if (!to) return;

  const profile = order.profiles as unknown as { full_name: string | null } | null;
  const payments = order.payments as unknown as { amount: number }[] | null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const amount = money(payments?.[0]?.amount ?? order.total);
  const n = order.order_number;

  const bodyHtml = `
    <p>Hi ${firstName},</p>
    <p>We've processed a refund of <strong>${amount}</strong> for order #${n}.</p>
    ${reason ? `<p style="color:#666666;">Reason: ${esc(reason)}</p>` : ""}
    ${renderInfoGrid([
      { label: "Order #", value: n },
      { label: "Refund amount", value: amount },
    ])}
  `;

  await sendEmail({
    to,
    subject: `Refund processed — #${n}`,
    html: renderEmailShell({
      preheader: `A refund of ${amount} has been processed for order #${n}.`,
      heading: "Refund processed",
      bodyHtml,
      ctaLabel: "View order details",
      ctaUrl: `${SITE_URL}/orders/${order.id}`,
    }),
  });
}

/** New-order alert for a merchant or FasTrack warehouse staff — sent once
 * per recipient, right after placeOrder() creates the order. */
export async function sendNewOrderEmails(userIds: string[], orderNumber: string, portalUrl: string) {
  const emails = await emailsFor(userIds);
  await Promise.all(
    [...emails.values()].map((to) =>
      sendEmail({
        to,
        subject: `New order received — #${orderNumber}`,
        html: renderEmailShell({
          preheader: `Order #${orderNumber} needs confirmation.`,
          heading: "New order received",
          bodyHtml: `<p>Order #${orderNumber} needs confirmation.</p>`,
          ctaLabel: "View order",
          ctaUrl: `${SITE_URL}${portalUrl}`,
        }),
      })
    )
  );
}

/** Tells a merchant/staff a order they were already alerted about (and may
 * have started preparing) has since been cancelled. */
export async function sendOrderCancelledSellerEmails(userIds: string[], orderNumber: string, portalUrl: string) {
  const emails = await emailsFor(userIds);
  await Promise.all(
    [...emails.values()].map((to) =>
      sendEmail({
        to,
        subject: `Order cancelled — #${orderNumber}`,
        html: renderEmailShell({
          preheader: `Order #${orderNumber} has been cancelled. No need to prepare it.`,
          heading: "Order cancelled",
          bodyHtml: `<p>Order #${orderNumber} has been cancelled. No need to prepare it.</p>`,
          ctaLabel: "View orders",
          ctaUrl: `${SITE_URL}${portalUrl}`,
        }),
      })
    )
  );
}

/** Approve/reject outcome for a single applicant (rider or supplier). */
export async function sendApplicationDecisionEmail(userId: string, title: string, body: string, portalUrl: string) {
  const emails = await emailsFor([userId]);
  const to = emails.get(userId);
  if (!to) return;
  await sendEmail({
    to,
    subject: title,
    html: renderEmailShell({
      preheader: body,
      heading: title,
      bodyHtml: `<p>${body}</p>`,
      ctaLabel: "View status",
      ctaUrl: `${SITE_URL}${portalUrl}`,
    }),
  });
}

/** New rider/supplier application alert for every admin. */
export async function sendNewApplicationEmails(title: string, body: string, portalUrl: string) {
  const supabase = await createClient();
  const { data: adminIds } = await supabase.rpc("admin_user_ids");
  const ids = ((adminIds ?? []) as { user_id: string }[]).map((r) => r.user_id);
  const emails = await emailsFor(ids);
  await Promise.all(
    [...emails.values()].map((to) =>
      sendEmail({
        to,
        subject: title,
        html: renderEmailShell({
          preheader: body,
          heading: title,
          bodyHtml: `<p>${body}</p>`,
          ctaLabel: "Review",
          ctaUrl: `${SITE_URL}${portalUrl}`,
        }),
      })
    )
  );
}
