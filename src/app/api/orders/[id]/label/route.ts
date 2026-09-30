import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getLabelData } from "@/lib/orders";
import { buildLabelPdf } from "@/lib/label-pdf";
import { INVOICE_LOGO_DATA_URL } from "@/lib/invoice-logo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // getLabelData relies on RLS to scope access (owner, admin, or assigned
  // rider only) — a null result here means either the order doesn't exist
  // or the requester isn't allowed to see it, which look identical to the
  // client by design.
  const order = await getLabelData(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // The QR just encodes the order number itself (like a barcode payload),
  // never a URL or anything else — this document travels on the outside of
  // a physical package.
  const qrPng = new Uint8Array(await QRCode.toBuffer(order.order_number, { type: "png", margin: 1, width: 300 }));
  const logoPng = Uint8Array.from(atob(INVOICE_LOGO_DATA_URL.split(",")[1]), (c) => c.charCodeAt(0));

  const pdfBytes = await buildLabelPdf({ order, qrPng, logoPng });

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="label-${order.order_number}.pdf"`,
    },
  });
}
