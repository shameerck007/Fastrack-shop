import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getInvoiceData } from "@/lib/orders";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import { buildZatcaQrPayload } from "@/lib/zatca";

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

  const qrPayload = buildZatcaQrPayload({
    timestamp: order.created_at,
    totalWithVat: order.total,
    vatTotal: order.vat,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 300 });

  // @react-pdf/renderer's Image doesn't reliably resolve local file paths
  // inside a Next.js route handler, so read it ourselves and pass a data URI
  // (the same approach already used for the QR code).
  const logoBuffer = await readFile(path.join(process.cwd(), "public/fastrack-logo-full.png"));
  const logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const pdfBuffer = await renderToBuffer(InvoiceDocument({ order, qrDataUrl, logoDataUrl }));

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.order_number}.pdf"`,
    },
  });
}
