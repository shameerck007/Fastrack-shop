import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import {
  renderEmailShell,
  renderInfoGrid,
  renderOrderItemsTable,
  renderSummaryTable,
  renderBoxSection,
  type EmailLineItem,
} from "@/lib/email-template";
import { formatSAR } from "@/lib/utils";
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

function estimateArrival(deliveryType: DeliveryType, scheduledFor: string | null): string {
  if (deliveryType === "scheduled" && scheduledFor) {
    return new Date(scheduledFor).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  return deliveryType === "express" ? "Today, 15–30 min" : "Today, 30–60 min";
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

/** The rich, itemized Amazon/Noon-style confirmation — sent once, right
 * after placeOrder() creates the order. */
export async function sendOrderConfirmationEmail(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, subtotal, delivery_fee, total, created_at, delivery_type, scheduled_for, addresses(address_line, city, district, receiver_name, receiver_phone), order_items(product_name, variant_label, ordered_quantity, line_total, product_variants!variant_id(products(image_url))), payments(method), profiles(full_name)"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const emails = await emailsFor([order.user_id]);
  const to = emails.get(order.user_id);
  if (!to) return;

  const items: EmailLineItem[] = ((order.order_items ?? []) as unknown as OrderItemRow[]).map((i) => ({
    name: i.product_name,
    variant: i.variant_label,
    quantity: i.ordered_quantity,
    lineTotalFormatted: formatSAR(Number(i.line_total)),
    imageUrl: i.product_variants?.products?.image_url ?? null,
  }));

  const address = order.addresses as unknown as AddressRow;
  const profile = order.profiles as unknown as { full_name: string | null } | null;
  const payments = order.payments as unknown as { method: string }[] | null;
  const paymentMethod = PAYMENT_METHOD_LABEL[payments?.[0]?.method ?? "cash_on_delivery"] ?? "Cash on Delivery";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const bodyHtml = `
    <p>Hi ${firstName},</p>
    <p>Thanks for your order! We'll email you again as soon as it's on its way.</p>
    ${renderInfoGrid([
      { label: "Order #", value: order.order_number },
      { label: "Order date", value: formatOrderDate(order.created_at) },
      { label: "Order total", value: formatSAR(order.total) },
      { label: "Arriving", value: estimateArrival(order.delivery_type, order.scheduled_for) },
    ])}
    <p style="margin:24px 0 8px;font-weight:700;color:#111111;font-size:15px;">Items in this order</p>
    ${renderOrderItemsTable(items)}
    <div style="margin-top:16px;max-width:260px;margin-inline-start:auto;">
      ${renderSummaryTable([
        { label: "Item(s) subtotal", value: formatSAR(order.subtotal) },
        { label: "Delivery", value: order.delivery_fee > 0 ? formatSAR(order.delivery_fee) : "Free" },
        { label: "Order total", value: formatSAR(order.total), bold: true },
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

  await sendEmail({
    to,
    subject: `Ordered: your FasTrack order #${order.order_number}`,
    html: renderEmailShell({
      preheader: `Order #${order.order_number} confirmed — ${formatSAR(order.total)}`,
      heading: "Order confirmed",
      bodyHtml,
      ctaLabel: "View order details",
      ctaUrl: `${SITE_URL}/orders/${order.id}`,
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

/** A lighter, non-itemized status-change email — mirrors the push/bell
 * copy but as a branded email, plus an order-info recap so it still reads
 * as complete on its own. Only fires for delivered/cancelled — see
 * STATUS_EMAIL above. */
export async function sendOrderStatusEmail(orderId: string, status: OrderStatus) {
  const template = STATUS_EMAIL[status];
  if (!template) return;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, order_number, total, created_at, profiles(full_name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const emails = await emailsFor([order.user_id]);
  const to = emails.get(order.user_id);
  if (!to) return;

  const profile = order.profiles as unknown as { full_name: string | null } | null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const n = order.order_number;

  const bodyHtml = `
    <p>Hi ${firstName},</p>
    <p>${template.body.replace("{n}", n)}</p>
    ${renderInfoGrid([
      { label: "Order #", value: n },
      { label: "Order date", value: formatOrderDate(order.created_at) },
      { label: "Order total", value: formatSAR(order.total) },
    ])}
  `;

  await sendEmail({
    to,
    subject: template.subject.replace("{n}", n),
    html: renderEmailShell({
      preheader: template.body.replace("{n}", n),
      heading: template.heading,
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
