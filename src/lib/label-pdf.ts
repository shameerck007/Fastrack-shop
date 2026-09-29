import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LabelData } from "@/lib/orders";
import { formatSAR } from "@/lib/utils";

// Same pdf-lib approach as invoice-pdf.ts (pure JS, runs on Cloudflare
// Workers) — see the comment there for why. Standard fonts only cover
// Latin-1, so Arabic text is replaced rather than crashing the render.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

// Standard 4x6in thermal shipping-label size (in points), same as
// Amazon/Noon courier labels — a size most label printers and most regular
// printers (as a half-sheet) both handle.
const PAGE_W = 288;
const PAGE_H = 432;
const M = 16;
const BLUE = rgb(0.114, 0.306, 0.847);
const GRAY = rgb(0.45, 0.45, 0.45);
const DARK = rgb(0.09, 0.09, 0.09);
const RED = rgb(0.75, 0.1, 0.1);

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  express: "EXPRESS",
  standard: "STANDARD",
  scheduled: "SCHEDULED",
};

export async function buildLabelPdf({
  order,
  qrPng,
  logoPng,
}: {
  order: LabelData;
  qrPng: Uint8Array;
  logoPng: Uint8Array;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Delivery label ${order.order_number}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean; center?: boolean } = {}
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 9;
    const str = latin1(s);
    const w = f.widthOfTextAtSize(str, size);
    const px = opts.right ? x - w : opts.center ? x - w / 2 : x;
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

  // Header: small logo + "DELIVERY LABEL"
  const logo = await pdf.embedPng(logoPng);
  const logoW = 70;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: y - logoH, width: logoW, height: logoH });
  text(page, "DELIVERY LABEL", PAGE_W - M, y - 12, { size: 11, font: bold, color: BLUE, right: true });
  text(page, new Date(order.created_at).toLocaleDateString("en-SA"), PAGE_W - M, y - 24, {
    size: 8,
    color: GRAY,
    right: true,
  });
  y -= Math.max(logoH, 32) + 8;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1.5, color: DARK });
  y -= 4;

  // Delivery type + order number strip
  y -= 14;
  page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 20, color: rgb(0.937, 0.965, 1) });
  text(page, DELIVERY_TYPE_LABEL[order.delivery_type] ?? order.delivery_type.toUpperCase(), M + 6, y, {
    size: 9,
    font: bold,
    color: BLUE,
  });
  text(page, `#${order.order_number}`, PAGE_W - M - 6, y, { size: 9, font: bold, right: true });
  y -= 22;

  // COD badge — the single most important thing on the label for a rider
  // handling cash collection, so it gets its own bordered, high-contrast box.
  const isCod = order.payments[0]?.method === "cash_on_delivery";
  if (isCod) {
    const boxH = 26;
    page.drawRectangle({
      x: M,
      y: y - boxH,
      width: PAGE_W - 2 * M,
      height: boxH,
      borderColor: RED,
      borderWidth: 1.5,
      color: rgb(1, 0.96, 0.96),
    });
    text(page, "COLLECT ON DELIVERY", M + 8, y - 10, { size: 8, font: bold, color: RED });
    text(page, formatSAR(order.total), PAGE_W - M - 8, y - 18, { size: 14, font: bold, color: RED, right: true });
    y -= boxH + 10;
  } else {
    text(page, `Prepaid — ${formatSAR(order.total)}`, M, y - 10, { size: 9, color: GRAY });
    y -= 22;
  }

  // DELIVER TO — the most prominent block on the page (large, bold), same
  // emphasis as an Amazon/Noon "TO" address block.
  text(page, "DELIVER TO", M, y, { size: 8, font: bold, color: GRAY });
  y -= 16;
  const a = order.addresses;
  if (a) {
    if (a.receiver_name) {
      text(page, a.receiver_name, M, y, { size: 13, font: bold });
      y -= 16;
    }
    if (a.receiver_phone) {
      text(page, a.receiver_phone, M, y, { size: 10, color: GRAY });
      y -= 14;
    }
    const addressLines = [
      a.address_line,
      [a.building_number && `Bldg ${a.building_number}`, a.unit_number && `Unit ${a.unit_number}`, a.district]
        .filter(Boolean)
        .join(", "),
      [a.city, a.postal_code].filter(Boolean).join(" "),
      a.short_address ? `National Address: ${a.short_address}` : "",
    ].filter(Boolean);
    for (const line of addressLines) {
      for (const w of wrap(line, PAGE_W - 2 * M, font, 10)) {
        text(page, w, M, y, { size: 10 });
        y -= 13;
      }
    }
  } else {
    text(page, "No delivery address on file", M, y, { size: 10, color: GRAY });
    y -= 13;
  }
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });
  y -= 16;

  // FROM — smaller, secondary block (the pickup warehouse), same relative
  // weight as a courier label's "FROM" line.
  text(page, "FROM", M, y, { size: 8, font: bold, color: GRAY });
  y -= 13;
  const wh = order.warehouses;
  if (wh) {
    text(page, wh.name, M, y, { size: 10, font: bold });
    y -= 13;
    if (wh.address_line) {
      for (const w of wrap(wh.address_line, PAGE_W - 2 * M, font, 9)) {
        text(page, w, M, y, { size: 9, color: GRAY });
        y -= 11;
      }
    }
  } else {
    text(page, "FasTrack Shop", M, y, { size: 10, font: bold });
    y -= 13;
  }
  y -= 8;

  // Item count + notes
  text(page, `${order.order_items.length} item${order.order_items.length === 1 ? "" : "s"}`, M, y, {
    size: 9,
    color: GRAY,
  });
  y -= 12;
  if (order.notes) {
    for (const w of wrap(`Note: ${order.notes}`, PAGE_W - 2 * M, font, 8)) {
      text(page, w, M, y, { size: 8, color: GRAY });
      y -= 10;
    }
  }

  // Footer: QR (order number only — never anything customer-confidential
  // like the delivery OTP) + a scan hint, pinned to the bottom of the page.
  const qr = await pdf.embedPng(qrPng);
  const qrSize = 84;
  const qrY = M + 14;
  page.drawImage(qr, { x: (PAGE_W - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
  text(page, `#${order.order_number}`, PAGE_W / 2, qrY - 2, { size: 9, font: bold, center: true });
  page.drawLine({
    start: { x: M, y: qrY + qrSize + 10 },
    end: { x: PAGE_W - M, y: qrY + qrSize + 10 },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.85),
  });

  return pdf.save();
}
