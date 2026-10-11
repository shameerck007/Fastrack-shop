import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfMoneyFor } from "@/lib/money";
import type { Statement } from "@/lib/statement";

// Standard PDF fonts only cover Latin-1, so other characters are replaced instead of failing.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const W = 595;
const H = 842;
const M = 40;
const BLUE = rgb(0.114, 0.306, 0.847);
const GRAY = rgb(0.45, 0.45, 0.45);
const DARK = rgb(0.09, 0.09, 0.09);
const LINE = rgb(0.9, 0.9, 0.9);

/** A settlement statement as a printable A4 PDF: summary, orders and payouts for the period. */
export async function buildStatementPdf(s: Statement, currency: string, companyName: string): Promise<Uint8Array> {
  const money = pdfMoneyFor(currency);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Settlement statement ${s.store.name} ${s.from} to ${s.to}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const f = o.font ?? font;
    const size = o.size ?? 10;
    const str = latin1(t);
    page.drawText(str, { x: o.right ? x - f.widthOfTextAtSize(str, size) : x, y: yy, size, font: f, color: o.color ?? DARK });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.6, color: LINE });
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };

  text(companyName, M, y, { size: 18, font: bold, color: BLUE });
  text("Settlement statement", W - M, y, { size: 14, font: bold, right: true });
  y -= 22;
  text(`Supplier: ${s.store.name}${s.store.city ? `, ${s.store.city}` : ""}`, M, y, { size: 10, font: bold });
  text(`Period: ${s.from} to ${s.to}`, W - M, y, { right: true, color: GRAY });
  y -= 14;
  const ids = [s.store.vat_number ? `Tax no. ${s.store.vat_number}` : null, s.store.cr_number ? `Reg. no. ${s.store.cr_number}` : null].filter(Boolean).join("   ");
  if (ids) text(ids, M, y, { color: GRAY });
  text(`Amounts in ${currency}`, W - M, y, { right: true, color: GRAY });
  y -= 20;
  rule(y + 6);

  const row = (label: string, value: string, o: { strong?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    text(label, M, y, { font: o.strong ? bold : font, color: o.color });
    text(value, W - M, y, { font: o.strong ? bold : font, right: true, color: o.color });
    y -= 15;
  };
  row("Opening balance (owed to the supplier)", money(s.opening_balance));
  row("Sales on delivered orders", money(s.sales));
  row("Refunds to customers", `-${money(s.refunds)}`);
  row("FasTrack commission", `-${money(s.commission)}`);
  if (s.supplier_discounts > 0) row("Discounts paid by the supplier", `-${money(s.supplier_discounts)}`);
  row("Net for the period", money(s.net_for_period), { strong: true });
  row("Paid out in the period", `-${money(s.paid_in_period)}`);
  rule(y + 10);
  y -= 2;
  row("Closing balance (owed to the supplier)", money(s.closing_balance), { strong: true, color: BLUE });
  y -= 2;
  text(`The sales include ${money(s.tax_inside)} of tax (VAT / GST) that is part of the customer prices.`, M, y, { size: 8.5, color: GRAY });
  y -= 24;

  text(`Orders delivered in the period (${s.orders})`, M, y, { font: bold, size: 11 });
  y -= 16;
  const cols = { order: M, date: M + 80, sales: M + 270, ref: M + 345, com: M + 425, net: W - M };
  const head = () => {
    text("Order", cols.order, y, { size: 8.5, font: bold, color: GRAY });
    text("Delivered", cols.date, y, { size: 8.5, font: bold, color: GRAY });
    text("Sales", cols.sales, y, { size: 8.5, font: bold, color: GRAY, right: true });
    text("Refunded", cols.ref, y, { size: 8.5, font: bold, color: GRAY, right: true });
    text("Commission", cols.com, y, { size: 8.5, font: bold, color: GRAY, right: true });
    text("Net", cols.net, y, { size: 8.5, font: bold, color: GRAY, right: true });
    y -= 6;
    rule(y);
    y -= 12;
  };
  head();
  for (const o of s.order_rows) {
    if (y < M + 90) {
      newPage();
      head();
    }
    text(o.order_number, cols.order, y);
    text(o.delivered_at ? o.delivered_at.slice(0, 10) : "-", cols.date, y, { color: GRAY });
    text(money(o.sales), cols.sales, y, { right: true });
    text(o.refunded > 0 ? `-${money(o.refunded)}` : "-", cols.ref, y, { right: true, color: o.refunded > 0 ? rgb(0.7, 0.35, 0) : GRAY });
    text(money(o.commission), cols.com, y, { right: true, color: GRAY });
    text(money(o.net), cols.net, y, { right: true, font: bold });
    y -= 14;
  }
  if (s.order_rows.length === 0) {
    text("No delivered orders in this period.", M, y, { color: GRAY });
    y -= 14;
  }

  y -= 14;
  if (y < M + 80) newPage();
  text(`Payments made to the supplier (${s.payout_rows.length})`, M, y, { font: bold, size: 11 });
  y -= 16;
  if (s.payout_rows.length === 0) text("No payments in this period.", M, y, { color: GRAY });
  for (const p of s.payout_rows) {
    if (y < M + 30) newPage();
    text(p.date.slice(0, 10), M, y, { color: GRAY });
    text(`${p.method.replace(/_/g, " ")}${p.reference ? `  ref ${p.reference}` : ""}`, M + 80, y);
    text(money(p.amount), W - M, y, { right: true, font: bold });
    y -= 14;
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) => pg.drawText(latin1(`${companyName} settlement statement   page ${i + 1} of ${pages.length}`), { x: M, y: 20, size: 8, font, color: GRAY }));
  return pdf.save();
}
