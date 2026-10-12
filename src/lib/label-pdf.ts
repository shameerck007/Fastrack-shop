import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfMoneyFor } from "@/lib/money";
import { code128Supports, code128Widths } from "@/lib/code128";
import type { LabelData } from "@/lib/orders";

// Same pdf-lib approach as invoice-pdf.ts (pure JS, runs on Cloudflare Workers). Standard fonts only cover Latin-1,
// so Arabic text is replaced rather than crashing the render.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

// A 4 x 6 inch shipping label, the size thermal label printers use (Amazon, Noon and courier labels). Black and white only,
// so it prints cleanly on a thermal printer. Regular printers print it as a half sheet.
const PAGE_W = 288;
const PAGE_H = 432;
const OUT = 8; // outer border inset
const M = 16; // content margin
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.38, 0.38, 0.38);
const WHITE = rgb(1, 1, 1);

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  express: "EXPRESS",
  standard: "STANDARD",
  scheduled: "SCHEDULED",
};

export async function buildLabelPdf({ order, qrPng, logoPng }: { order: LabelData; qrPng: Uint8Array; logoPng: Uint8Array }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Shipping label ${order.order_number}`);
  const money = pdfMoneyFor(order.currency ?? "SAR");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean; center?: boolean } = {}) => {
    const f = o.font ?? font;
    const size = o.size ?? 9;
    const str = latin1(s);
    const w = f.widthOfTextAtSize(str, size);
    p.drawText(str, { x: o.right ? x - w : o.center ? x - w / 2 : x, y: yy, size, font: f, color: o.color ?? BLACK });
  };
  const wrap = (s: string, maxW: number, f: PDFFont, size: number): string[] => {
    const words = latin1(s).split(/\s+/).filter(Boolean);
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
  const fit = (s: string, maxW: number, f: PDFFont, startSize: number, minSize: number) => {
    let size = startSize;
    while (size > minSize && f.widthOfTextAtSize(latin1(s), size) > maxW) size -= 0.5;
    return size;
  };
  const hline = (yy: number, thickness = 1) => page.drawLine({ start: { x: OUT, y: yy }, end: { x: PAGE_W - OUT, y: yy }, thickness, color: BLACK });
  const contentW = PAGE_W - 2 * M;

  page.drawRectangle({ x: OUT, y: OUT, width: PAGE_W - 2 * OUT, height: PAGE_H - 2 * OUT, borderColor: BLACK, borderWidth: 1.5 });

  // ---------------------------------------------------------------- header: logo, delivery type
  let y = PAGE_H - OUT;
  const headH = 40;
  const logo = await pdf.embedPng(logoPng);
  const logoW = 78;
  const logoH = Math.min(26, (logo.height / logo.width) * logoW);
  page.drawImage(logo, { x: M, y: y - headH / 2 - logoH / 2, width: (logo.width / logo.height) * logoH, height: logoH });
  const typeLabel = DELIVERY_TYPE_LABEL[order.delivery_type] ?? order.delivery_type.toUpperCase();
  const typeSize = 13;
  const typeW = bold.widthOfTextAtSize(typeLabel, typeSize) + 22;
  page.drawRectangle({ x: PAGE_W - M - typeW, y: y - headH / 2 - 13, width: typeW, height: 26, color: BLACK });
  text(page, typeLabel, PAGE_W - M - typeW / 2, y - headH / 2 - 4.5, { size: typeSize, font: bold, color: WHITE, center: true });
  y -= headH;
  hline(y, 2);

  // ---------------------------------------------------------------- deliver to
  y -= 15;
  text(page, "DELIVER TO", M, y, { size: 7.5, font: bold, color: GRAY });
  const a = order.addresses;
  if (a) {
    y -= 19;
    const name = a.receiver_name || order.profiles?.full_name || "Customer";
    text(page, name, M, y, { size: fit(name, contentW, bold, 17, 11), font: bold });
    const phone = a.receiver_phone || order.profiles?.phone;
    if (phone) {
      y -= 15;
      text(page, phone, M, y, { size: 11.5, font: bold });
    }
    const lines = [
      a.address_line,
      [a.building_number && `Bldg ${a.building_number}`, a.unit_number && `Unit ${a.unit_number}`].filter(Boolean).join(", "),
      a.short_address ? `National Address: ${a.short_address}` : "",
    ]
      .filter(Boolean)
      .flatMap((l) => wrap(l as string, contentW, font, 10))
      .slice(0, 3);
    for (const l of lines) {
      y -= 12.5;
      text(page, l, M, y, { size: 10 });
    }
    // The area, large, so a sorter can read it at a glance (like the sort code on Amazon and Noon labels).
    const area = [a.district, a.city].filter(Boolean).join(" - ").toUpperCase() || a.city.toUpperCase();
    y -= 9;
    const areaH = 24;
    page.drawRectangle({ x: M, y: y - areaH, width: contentW, height: areaH, borderColor: BLACK, borderWidth: 1.5 });
    text(page, area, PAGE_W / 2, y - 16.5, { size: fit(area, contentW - 12, bold, 14, 8), font: bold, center: true });
    y -= areaH;
    if (a.postal_code) {
      text(page, a.postal_code, PAGE_W - M, y - 10, { size: 8, color: GRAY, right: true });
    }
  } else {
    y -= 18;
    text(page, "No delivery address on file", M, y, { size: 10, color: GRAY });
  }
  y -= 14;

  // ---------------------------------------------------------------- payment: the most important thing for the rider
  const isCod = order.payments[0]?.method === "cash_on_delivery";
  const payH = 36;
  if (isCod) {
    page.drawRectangle({ x: M, y: y - payH, width: contentW, height: payH, color: BLACK });
    text(page, "COLLECT", M + 10, y - 15, { size: 8, font: bold, color: WHITE });
    text(page, "CASH ON DELIVERY", M + 10, y - 27, { size: 8, font: bold, color: WHITE });
    const amount = money(order.total);
    text(page, amount, PAGE_W - M - 10, y - 25, { size: fit(amount, contentW - 120, bold, 20, 12), font: bold, color: WHITE, right: true });
  } else {
    page.drawRectangle({ x: M, y: y - payH, width: contentW, height: payH, borderColor: BLACK, borderWidth: 1.5 });
    text(page, "PREPAID", M + 10, y - 23, { size: 15, font: bold });
    text(page, "NO CASH TO COLLECT", PAGE_W - M - 10, y - 22, { size: 8.5, font: bold, right: true });
  }
  y -= payH + 8;

  // ---------------------------------------------------------------- meta cells
  const cellH = 28;
  const itemCount = order.order_items.length;
  const dateText = new Date(order.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const cells: [string, string][] = [
    ["ITEMS", String(itemCount)],
    ["PARCEL", "1 of 1"],
    ["ORDERED", dateText],
  ];
  const cw = contentW / cells.length;
  page.drawRectangle({ x: M, y: y - cellH, width: contentW, height: cellH, borderColor: BLACK, borderWidth: 1 });
  cells.forEach(([k, v], i) => {
    const cx = M + cw * i;
    if (i > 0) page.drawLine({ start: { x: cx, y: y }, end: { x: cx, y: y - cellH }, thickness: 1, color: BLACK });
    text(page, k, cx + 7, y - 10, { size: 6.5, font: bold, color: GRAY });
    text(page, v, cx + 7, y - 22, { size: fit(v, cw - 12, bold, 10.5, 7), font: bold });
  });
  y -= cellH + 10;

  // ---------------------------------------------------------------- from
  const wh = order.warehouses;
  text(page, "FROM", M, y, { size: 7, font: bold, color: GRAY });
  text(page, wh?.name ?? "FasTrack Shop", M + 28, y, { size: 9, font: bold });
  if (wh?.address_line) {
    for (const l of wrap(wh.address_line, contentW - 28, font, 8).slice(0, 2)) {
      if (y - 10 < 164) break;
      y -= 10;
      text(page, l, M + 28, y, { size: 8, color: GRAY });
    }
  }
  if (order.notes && y > 178) {
    y -= 12;
    for (const l of wrap(`Note: ${order.notes}`, contentW, font, 7.5).slice(0, 2)) {
      if (y < 164) break;
      text(page, l, M, y, { size: 7.5, color: GRAY });
      y -= 9;
    }
  }

  // ---------------------------------------------------------------- bottom: barcode, order number, QR (kept clear of the text above)
  const qrSize = 54;
  const qrY = OUT + 12;
  const qr = await pdf.embedPng(qrPng);
  page.drawImage(qr, { x: PAGE_W - M - qrSize, y: qrY, width: qrSize, height: qrSize });
  text(page, "SCAN AT PICKUP", M, qrY + qrSize - 6, { size: 8, font: bold });
  text(page, "Rider scans this label to", M, qrY + qrSize - 18, { size: 7.5, color: GRAY });
  text(page, "confirm the right parcel.", M, qrY + qrSize - 27, { size: 7.5, color: GRAY });
  text(page, "Do not remove this label.", M, qrY + 4, { size: 7, color: GRAY });

  const rule = qrY + qrSize + 6;
  hline(rule, 1.5);
  const numSize = fit(`#${order.order_number}`, contentW, bold, 18, 11);
  text(page, `#${order.order_number}`, PAGE_W / 2, rule + 9, { size: numSize, font: bold, center: true });
  const barBase = rule + 9 + numSize + 5;
  const barH = 36;
  if (code128Supports(order.order_number)) {
    const widths = code128Widths(order.order_number);
    const modules = widths.reduce((s, w) => s + w, 0);
    const mod = Math.min(2.2, contentW / (modules + 20));
    let x = (PAGE_W - modules * mod) / 2;
    widths.forEach((w, i) => {
      if (i % 2 === 0) page.drawRectangle({ x, y: barBase, width: w * mod, height: barH, color: BLACK });
      x += w * mod;
    });
  }
  hline(barBase + barH + 8, 1.5);

  return pdf.save();
}
