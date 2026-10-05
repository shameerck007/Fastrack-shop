import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getInvoiceData } from "@/lib/orders";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { buildZatcaQrPayload } from "@/lib/zatca";
import { getOrderSeller } from "@/lib/order-seller";
import { INVOICE_LOGO_DATA_URL } from "@/lib/invoice-logo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // getInvoiceData relies on RLS to scope access (owner, admin, or assigned
  // rider only) — a null result here means either the order doesn't exist
  // or the requester isn't allowed to see it, which look identical to the
  // client by design.
  const order = await getInvoiceData(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  // Marketplace seller-of-record: whichever store owns the warehouse this
  // order was fulfilled from (or FasTrack's own company_settings if it was
  // fulfilled from a FasTrack-owned warehouse).
  const company = await getOrderSeller(order.warehouse_id);

  // Saudi invoices carry the ZATCA QR; other markets get a plain QR pointing back to the order.
  const qrPayload =
    order.country_code && order.country_code !== "SA"
      ? `Invoice ${order.order_number} | ${company.trading_name} | ${order.total}`
      : buildZatcaQrPayload({
    sellerName: company.trading_name,
    vatNumber: company.vat_number ?? "",
    timestamp: order.created_at,
    totalWithVat: order.total,
    vatTotal: order.vat,
  });
  const qrPng = new Uint8Array(await QRCode.toBuffer(qrPayload, { type: "png", margin: 1, width: 300 }));
  const logoPng = Uint8Array.from(atob(INVOICE_LOGO_DATA_URL.split(",")[1]), (c) => c.charCodeAt(0));

  const pdfBytes = await buildInvoicePdf({ order, qrPng, logoPng, company });

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.order_number}.pdf"`,
    },
  });
}
