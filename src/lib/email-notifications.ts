import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { renderEmailShell, renderOrderItemsTable, renderSummaryTable, type EmailLineItem } from "@/lib/email-template";
import { formatSAR } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const SITE_URL = "https://shop.fastrack.cloud";

async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_emails_for", { target_user_ids: ids });
  return new Map(((data ?? []) as { user_id: string; email: string }[]).map((r) => [r.user_id, r.email]));
}

type OrderItemRow = {
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  line_total: number;
  product_variants: { products: { image_url: string | null } | null } | null;
};

/** The rich, itemized Amazon/Noon-style confirmation — sent once, right
 * after placeOrder() creates the order. */
export async function sendOrderConfirmationEmail(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, subtotal, delivery_fee, total, addresses(address_line, city), order_items(product_name, variant_label, ordered_quantity, line_total, product_variants!variant_id(products(image_url)))"
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

  const address = order.addresses as unknown as { address_line: string; city: string } | null;

  const bodyHtml = `
    <p>Thanks for your order! We'll email you again as soon as it's on its way.</p>
    <p style="margin:20px 0 8px;font-weight:700;color:#111111;">Order #${order.order_number}</p>
    ${renderOrderItemsTable(items)}
    <div style="margin-top:16px;">
      ${renderSummaryTable([
        { label: "Subtotal", value: formatSAR(order.subtotal) },
        { label: "Delivery", value: order.delivery_fee > 0 ? formatSAR(order.delivery_fee) : "Free" },
        { label: "Total", value: formatSAR(order.total), bold: true },
      ])}
    </div>
    ${address ? `<p style="margin-top:20px;"><strong>Deliver to:</strong><br/>${address.address_line}, ${address.city}</p>` : ""}
  `;

  await sendEmail({
    to,
    subject: `Your FasTrack order #${order.order_number} is confirmed`,
    html: renderEmailShell({
      preheader: `Order #${order.order_number} confirmed — ${formatSAR(order.total)}`,
      heading: "Order confirmed",
      bodyHtml,
      ctaLabel: "View your order",
      ctaUrl: `${SITE_URL}/orders/${order.id}`,
    }),
  });
}

const STATUS_EMAIL: Partial<Record<OrderStatus, { subject: string; heading: string; body: string }>> = {
  preparing: {
    subject: "Your order is being prepared — #{n}",
    heading: "Preparing your order",
    body: "Order #{n} is being packed.",
  },
  ready_for_pickup: {
    subject: "Your order is ready — #{n}",
    heading: "Ready for pickup",
    body: "Order #{n} is packed and waiting for a rider.",
  },
  rider_assigned: {
    subject: "A rider is on the way — #{n}",
    heading: "Rider on the way",
    body: "A rider has been assigned to order #{n}.",
  },
  out_for_delivery: {
    subject: "Your order is out for delivery — #{n}",
    heading: "Out for delivery",
    body: "Order #{n} is on its way to you.",
  },
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
 * copy but as a branded email. Skips "confirmed" and "pending", which the
 * order-confirmation email already covers. */
export async function sendOrderStatusEmail(orderId: string, status: OrderStatus) {
  const template = STATUS_EMAIL[status];
  if (!template) return;

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, user_id, order_number").eq("id", orderId).maybeSingle();
  if (!order) return;

  const emails = await emailsFor([order.user_id]);
  const to = emails.get(order.user_id);
  if (!to) return;

  const n = order.order_number;
  await sendEmail({
    to,
    subject: template.subject.replace("{n}", n),
    html: renderEmailShell({
      preheader: template.body.replace("{n}", n),
      heading: template.heading,
      bodyHtml: `<p>${template.body.replace("{n}", n)}</p>`,
      ctaLabel: "View your order",
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
