import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { InvoiceData } from "@/lib/orders";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";

// pdf-lib (unlike @react-pdf/renderer) is pure JS with no filesystem/URL
// font loading, so it runs on Cloudflare Workers. Standard fonts only cover
// Latin-1, so anything else (e.g. Arabic) is replaced rather than crashing.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const PAGE_W = 595;
const PAGE_H = 842;
const M = 36;
const BLUE = rgb(0.114, 0.306, 0.847);
const GRAY = rgb(0.45, 0.45, 0.45);
const DARK = rgb(0.09, 0.09, 0.09);

export async function buildInvoicePdf({
  order,
  qrPng,
  logoPng,
}: {
  order: InvoiceData;
  qrPng: Uint8Array;
  logoPng: Uint8Array;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.order_number}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const str = latin1(s);
    const px = opts.right ? x - f.widthOfTextAtSize(str, size) : x;
    p.drawText(str, { x: px, y: yy, size, font: f, color: opts.color ?? DARK });
  };

  const wrap = (s: string, maxW: number, f: PDFFont, size: number): string[] => {
    const words = latin1(s).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // Header: logo left, invoice meta right
  const logo = await pdf.embedPng(logoPng);
  const logoW = 150;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: y - logoH, width: logoW, height: logoH });
  text(page, "TAX INVOICE", PAGE_W - M, y - 14, { size: 16, font: bold, color: BLUE, right: true });
  text(page, `Order #${order.order_number}`, PAGE_W - M, y - 30, { size: 9, color: GRAY, right: true });
  text(page, new Date(order.created_at).toLocaleString("en-SA"), PAGE_W - M, y - 42, {
    size: 9,
    color: GRAY,
    right: true,
  });
  text(page, `Status: ${ORDER_STATUS_LABELS[order.status] ?? order.status}`, PAGE_W - M, y - 54, {
    size: 9,
    color: GRAY,
    right: true,
  });
  y -= Math.max(logoH, 60) + 10;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 18;

  // Sold by / Bill to
  const colX2 = PAGE_W / 2 + 10;
  text(page, "SOLD BY", M, y, { size: 8, font: bold, color: GRAY });
  text(page, "BILL TO", colX2, y, { size: 8, font: bold, color: GRAY });
  let yl = y - 13;
  for (const l of ["FasTrack Shop", "Riyadh, Saudi Arabia", "VAT Registration No: 300000000000003"]) {
    text(page, l, M, yl);
    yl -= 12;
  }
  let yr = y - 13;
  const billLines = [
    order.profiles?.full_name ?? "Customer",
    order.profiles?.phone ?? "",
    order.payments[0]
      ? `Payment: ${order.payments[0].method.replace(/_/g, " ").toUpperCase()} (${order.payments[0].status})`
      : "",
  ].filter(Boolean);
  for (const l of billLines) {
    text(page, l, colX2, yr);
    yr -= 12;
  }
  y = Math.min(yl, yr) - 8;

  // Ship to
  const a = order.addresses;
  if (a) {
    text(page, "SHIP TO", M, y, { size: 8, font: bold, color: GRAY });
    y -= 13;
    const shipLines = [
      a.receiver_name ? `${a.receiver_name}${a.receiver_phone ? `  |  ${a.receiver_phone}` : ""}` : "",
      a.address_line,
      [
        a.building_number && `Bldg ${a.building_number}`,
        a.unit_number && `Unit ${a.unit_number}`,
        a.district,
        a.city,
        a.postal_code,
      ]
        .filter(Boolean)
        .join(", "),
      a.short_address ? `National Address: ${a.short_address}` : "",
    ].filter(Boolean);
    for (const l of shipLines) {
      for (const w of wrap(l, PAGE_W - 2 * M, font, 10)) {
        text(page, w, M, y);
        y -= 12;
      }
    }
    y -= 8;
  }

  // Items table
  const colQty = 340;
  const colPrice = 440;
  const colTotal = PAGE_W - M;
  const drawTableHeader = () => {
    page.drawRectangle({ x: M, y: y - 16, width: PAGE_W - 2 * M, height: 20, color: rgb(0.937, 0.965, 1) });
    text(page, "Item", M + 6, y - 10, { font: bold });
    text(page, "Qty", colQty, y - 10, { font: bold, right: true });
    text(page, "Unit Price", colPrice, y - 10, { font: bold, right: true });
    text(page, "Total", colTotal - 6, y - 10, { font: bold, right: true });
    y -= 26;
  };
  drawTableHeader();

  for (const item of order.order_items) {
    const nameLines = wrap(`${item.product_name} (${item.variant_label})`, colQty - M - 60, font, 10);
    const rowH = nameLines.length * 12 + 8;
    if (y - rowH < M + 140) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
      drawTableHeader();
    }
    nameLines.forEach((l, i) => text(page, l, M + 6, y - i * 12));
    text(page, String(Number(item.ordered_quantity)), colQty, y, { right: true });
    text(page, formatSAR(item.unit_price), colPrice, y, { right: true });
    text(page, formatSAR(item.line_total), colTotal - 6, y, { right: true });
    y -= rowH - 2;
    page.drawLine({
      start: { x: M, y: y + 4 },
      end: { x: PAGE_W - M, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.95, 0.95, 0.95),
    });
  }

  // Totals
  if (y < M + 150) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  }
  y -= 10;
  const tl = PAGE_W - M - 220;
  const tr = PAGE_W - M - 6;
  const totalRow = (label: string, value: string, f: PDFFont = font, size = 10) => {
    text(page, label, tl, y, { font: f, size });
    text(page, value, tr, y, { font: f, size, right: true });
    y -= 14;
  };
  totalRow("Subtotal (incl. VAT)", formatSAR(order.subtotal));
  totalRow("  of which VAT (15%)", formatSAR(order.vat));
  totalRow("Delivery fee", order.delivery_fee === 0 ? "Free" : formatSAR(order.delivery_fee));
  if (order.discount > 0) totalRow("Discount", `-${formatSAR(order.discount)}`);
  page.drawLine({
    start: { x: tl, y: y + 8 },
    end: { x: PAGE_W - M, y: y + 8 },
    thickness: 1,
    color: rgb(0.83, 0.83, 0.83),
  });
  y -= 4;
  totalRow("Total", formatSAR(order.total), bold, 11);

  // Footer: QR + note
  const qr = await pdf.embedPng(qrPng);
  const qrY = Math.max(Math.min(y - 20, M + 90) - 90, M);
  page.drawImage(qr, { x: M, y: qrY, width: 90, height: 90 });
  const note =
    "Scan to verify this simplified tax invoice per ZATCA e-invoicing regulations. Thank you for shopping with FasTrack Shop - everything you need, delivered.";
  wrap(note, 320, font, 8).forEach((l, i) =>
    text(page, l, M + 105, qrY + 50 - i * 10, { size: 8, color: GRAY })
  );

  return pdf.save();
}
