import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfMoneyFor } from "@/lib/money";
import { code128Supports, code128Widths } from "@/lib/code128";
import type { LabelData } from "@/lib/orders";

// Same pdf-lib approach as invoice-pdf.ts (pure JS, runs on Cloudflare Workers). Standard fonts only cover Latin-1,
// so Arabic text is replaced rather than crashing the render.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

/**
 * Label sizes. The page is exactly the label, with no extra margin, so a label printer feeds one label per page and nothing is wasted:
 *   4x6  100 x 150 mm, the standard shipping label (Amazon, Noon and courier labels). The default.
 *   4x3  100 x 75 mm, a compact label for smaller parcels: half the label stock.
 *   a6   105 x 148 mm, for A6 label sheets and printers that take A6 paper.
 */
export type LabelSize = "4x6" | "4x3" | "a6";
export const LABEL_SIZES: { id: LabelSize; name: string; hint: string }[] = [
  { id: "4x6", name: "4 × 6 in (100 × 150 mm)", hint: "Standard shipping label" },
  { id: "4x3", name: "4 × 3 in (100 × 75 mm)", hint: "Compact, uses half the label stock" },
  { id: "a6", name: "A6 (105 × 148 mm)", hint: "For A6 paper and label sheets" },
];

// Black and white only, thin lines, no solid black blocks: it prints sharply on a thermal printer and uses very little ink or toner.
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.38, 0.38, 0.38);

const DELIVERY_TYPE_LABEL: Record<string, string> = { express: "EXPRESS", standard: "STANDARD", scheduled: "SCHEDULED" };

export async function buildLabelPdf({ order, qrPng, logoPng, size = "4x6" }: { order: LabelData; qrPng: Uint8Array; logoPng: Uint8Array; size?: LabelSize }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Shipping label ${order.order_number}`);
  const money = pdfMoneyFor(order.currency ?? "SAR");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const compact = size === "4x3";
  const PAGE_W = 288;
  const PAGE_H = compact ? 216 : 432;
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const OUT = compact ? 5 : 7; // outer border inset: as small as a printer can reliably print
  const M = compact ? 12 : 14;
  const contentW = PAGE_W - 2 * M;

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean; center?: boolean } = {}) => {
    const f = o.font ?? font;
    const sz = o.size ?? 9;
    const str = latin1(s);
    const w = f.widthOfTextAtSize(str, sz);
    p.drawText(str, { x: o.right ? x - w : o.center ? x - w / 2 : x, y: yy, size: sz, font: f, color: o.color ?? BLACK });
  };
  const wrap = (s: string, maxW: number, f: PDFFont, sz: number): string[] => {
    const words = latin1(s).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, sz) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const fit = (s: string, maxW: number, f: PDFFont, startSize: number, minSize: number) => {
    let sz = startSize;
    while (sz > minSize && f.widthOfTextAtSize(latin1(s), sz) > maxW) sz -= 0.5;
    return sz;
  };
  const hline = (yy: number, thickness = 1) => page.drawLine({ start: { x: OUT, y: yy }, end: { x: PAGE_W - OUT, y: yy }, thickness, color: BLACK });
  const box = (x: number, yTop: number, w: number, h: number, t = 1) => page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: BLACK, borderWidth: t });

  page.drawRectangle({ x: OUT, y: OUT, width: PAGE_W - 2 * OUT, height: PAGE_H - 2 * OUT, borderColor: BLACK, borderWidth: 1.25 });

  const a = order.addresses;
  const name = a?.receiver_name || order.profiles?.full_name || "Customer";
  const phone = a?.receiver_phone || order.profiles?.phone || "";
  const typeLabel = DELIVERY_TYPE_LABEL[order.delivery_type] ?? order.delivery_type.toUpperCase();
  const isCod = order.payments[0]?.method === "cash_on_delivery";
  const amount = money(order.total);
  const area = a ? [a.district, a.city].filter(Boolean).join(" - ").toUpperCase() || a.city.toUpperCase() : "";
  const addressLines = a
    ? [a.address_line, [a.building_number && `Bldg ${a.building_number}`, a.unit_number && `Unit ${a.unit_number}`].filter(Boolean).join(", "), a.short_address ? `National Address: ${a.short_address}` : ""].filter(Boolean)
    : [];
  const logo = await pdf.embedPng(logoPng);

  const drawBarcode = (baseY: number, h: number, maxMod: number) => {
    if (!code128Supports(order.order_number)) return;
    const widths = code128Widths(order.order_number);
    const modules = widths.reduce((s, w) => s + w, 0);
    const mod = Math.min(maxMod, contentW / (modules + 20));
    let x = (PAGE_W - modules * mod) / 2;
    widths.forEach((w, i) => {
      if (i % 2 === 0) page.drawRectangle({ x, y: baseY, width: w * mod, height: h, color: BLACK });
      x += w * mod;
    });
  };

  if (compact) {
    // ------------------------------------------------------------ 4 x 3 in: everything a rider needs, nothing else
    let y = PAGE_H - OUT;
    const headH = 26;
    const logoH = 16;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: M, y: y - headH / 2 - logoH / 2, width: logoW, height: logoH });
    const tw = bold.widthOfTextAtSize(typeLabel, 10) + 16;
    box(PAGE_W - M - tw, y - 5, tw, 16, 1.5);
    text(page, typeLabel, PAGE_W - M - tw / 2, y - 16.5, { size: 10, font: bold, center: true });
    text(page, `#${order.order_number}`, M + logoW + 10, y - 17, { size: 10, font: bold });
    y -= headH;
    hline(y, 1.25);

    y -= 14;
    text(page, name, M, y, { size: fit(name, contentW - (phone ? 96 : 0), bold, 12.5, 9), font: bold });
    if (phone) text(page, phone, PAGE_W - M, y, { size: 10, font: bold, right: true });
    for (const l of addressLines.flatMap((l) => wrap(l, contentW, font, 8.5)).slice(0, 2)) {
      y -= 11;
      text(page, l, M, y, { size: 8.5 });
    }
    if (area) {
      y -= 7;
      box(M, y, contentW, 17, 1.25);
      text(page, area, PAGE_W / 2, y - 12.5, { size: fit(area, contentW - 10, bold, 11, 7), font: bold, center: true });
      y -= 17;
    }
    y -= 6;
    const payH = 24;
    box(M, y, contentW, payH, isCod ? 2.5 : 1.25);
    if (isCod) {
      text(page, "COLLECT CASH", M + 8, y - 15, { size: 9, font: bold });
      text(page, amount, PAGE_W - M - 8, y - 17, { size: fit(amount, contentW - 110, bold, 15, 10), font: bold, right: true });
    } else {
      text(page, "PREPAID", M + 8, y - 16.5, { size: 12, font: bold });
      text(page, `${order.order_items.length} item${order.order_items.length === 1 ? "" : "s"} · no cash`, PAGE_W - M - 8, y - 15.5, { size: 8, font: bold, right: true });
    }
    y -= payH;

    // barcode fills what is left, down to the border
    const barBase = OUT + 16;
    const barTop = y - 7;
    const barH = Math.max(18, Math.min(46, barTop - barBase));
    drawBarcode(barBase, barH, 1.9);
    text(page, order.order_number, PAGE_W / 2, OUT + 5.5, { size: 8.5, font: bold, center: true });
  } else {
    // ------------------------------------------------------------ 4 x 6 in
    let y = PAGE_H - OUT;
    const headH = 38;
    const logoH = 24;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: M, y: y - headH / 2 - logoH / 2, width: logoW, height: logoH });
    const typeSize = 12;
    const typeW = bold.widthOfTextAtSize(typeLabel, typeSize) + 20;
    box(PAGE_W - M - typeW, y - headH / 2 + 12, typeW, 24, 2);
    text(page, typeLabel, PAGE_W - M - typeW / 2, y - headH / 2 - 4, { size: typeSize, font: bold, center: true });
    y -= headH;
    hline(y, 1.75);

    y -= 14;
    text(page, "DELIVER TO", M, y, { size: 7, font: bold, color: GRAY });
    if (a) {
      y -= 18;
      text(page, name, M, y, { size: fit(name, contentW, bold, 17, 11), font: bold });
      if (phone) {
        y -= 15;
        text(page, phone, M, y, { size: 11.5, font: bold });
      }
      for (const l of addressLines.flatMap((l) => wrap(l, contentW, font, 10)).slice(0, 3)) {
        y -= 12.5;
        text(page, l, M, y, { size: 10 });
      }
      y -= 8;
      box(M, y, contentW, 24, 1.5);
      text(page, area, PAGE_W / 2, y - 16.5, { size: fit(area, contentW - 12, bold, 14, 8), font: bold, center: true });
      y -= 24;
    } else {
      y -= 18;
      text(page, "No delivery address on file", M, y, { size: 10, color: GRAY });
    }
    y -= 12;

    // payment: the most important thing for the rider, drawn with a heavy border instead of a solid block
    const payH = 36;
    box(M, y, contentW, payH, isCod ? 3 : 1.25);
    if (isCod) {
      text(page, "COLLECT CASH", M + 10, y - 15, { size: 9, font: bold });
      text(page, "ON DELIVERY", M + 10, y - 26, { size: 8, font: bold });
      text(page, amount, PAGE_W - M - 10, y - 25, { size: fit(amount, contentW - 120, bold, 20, 12), font: bold, right: true });
    } else {
      text(page, "PREPAID", M + 10, y - 23, { size: 15, font: bold });
      text(page, "NO CASH TO COLLECT", PAGE_W - M - 10, y - 22, { size: 8.5, font: bold, right: true });
    }
    y -= payH + 7;

    const cellH = 26;
    const dateText = new Date(order.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const cells: [string, string][] = [
      ["ITEMS", String(order.order_items.length)],
      ["PARCEL", "1 of 1"],
      ["ORDERED", dateText],
    ];
    const cw = contentW / cells.length;
    box(M, y, contentW, cellH, 1);
    cells.forEach(([k, v], i) => {
      const cx = M + cw * i;
      if (i > 0) page.drawLine({ start: { x: cx, y }, end: { x: cx, y: y - cellH }, thickness: 1, color: BLACK });
      text(page, k, cx + 6, y - 9.5, { size: 6.5, font: bold, color: GRAY });
      text(page, v, cx + 6, y - 20.5, { size: fit(v, cw - 10, bold, 10, 7), font: bold });
    });
    y -= cellH + 9;

    const wh = order.warehouses;
    text(page, "FROM", M, y, { size: 7, font: bold, color: GRAY });
    text(page, wh?.name ?? "FasTrack Shop", M + 28, y, { size: 9, font: bold });

    // bottom block: barcode, order number, QR
    const qrSize = 50;
    const qrY = OUT + 10;
    const qr = await pdf.embedPng(qrPng);
    page.drawImage(qr, { x: PAGE_W - M - qrSize, y: qrY, width: qrSize, height: qrSize });
    text(page, "SCAN AT PICKUP", M, qrY + qrSize - 8, { size: 8, font: bold });
    text(page, "Rider scans this label to", M, qrY + qrSize - 19, { size: 7.5, color: GRAY });
    text(page, "confirm the right parcel.", M, qrY + qrSize - 28, { size: 7.5, color: GRAY });
    if (order.notes) {
      for (const [i, l] of wrap(`Note: ${order.notes}`, PAGE_W - 2 * M - qrSize - 8, font, 7).slice(0, 2).entries()) text(page, l, M, qrY + 8 - i * 8.5, { size: 7, color: GRAY });
    }
    const rule = qrY + qrSize + 5;
    hline(rule, 1.25);
    const numSize = fit(`#${order.order_number}`, contentW, bold, 18, 11);
    text(page, `#${order.order_number}`, PAGE_W / 2, rule + 8, { size: numSize, font: bold, center: true });
    const barBase = rule + 8 + numSize + 5;
    drawBarcode(barBase, 34, 2.2);
    hline(barBase + 34 + 7, 1.25);
  }

  if (size === "a6") {
    // The same label on A6 paper (105 x 148 mm), scaled to fit with no extra margin.
    const A6_W = 297.64;
    const A6_H = 419.53;
    const embedded = await pdf.embedPage(page);
    const scale = Math.min(A6_W / PAGE_W, A6_H / PAGE_H);
    pdf.removePage(0);
    const a6 = pdf.addPage([A6_W, A6_H]);
    a6.drawPage(embedded, { x: (A6_W - PAGE_W * scale) / 2, y: (A6_H - PAGE_H * scale) / 2, xScale: scale, yScale: scale });
  }

  return pdf.save();
}
