import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfMoneyFor } from "@/lib/money";
import { ENTRY_KIND_LABEL, type RiderStatement } from "@/lib/rider-statement";

// Standard PDF fonts only cover Latin-1, so other characters are replaced instead of failing.
const latin1 = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const W = 595;
const H = 842;
const M = 40;
const BLUE = rgb(0.114, 0.306, 0.847);
const GRAY = rgb(0.45, 0.45, 0.45);
const DARK = rgb(0.09, 0.09, 0.09);
const LINE = rgb(0.9, 0.9, 0.9);

/** A rider's settlement statement as a printable A4 PDF: summary, deliveries and money movements for the period. */
export async function buildRiderStatementPdf(s: RiderStatement, currency: string, companyName: string): Promise<Uint8Array> {
  const money = pdfMoneyFor(currency);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rider statement ${s.rider.name} ${s.from} to ${s.to}`);
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
  text("Rider statement", W - M, y, { size: 14, font: bold, right: true });
  y -= 22;
  text(`Rider: ${s.rider.name}  (${s.rider.pay_type === "salary" ? "monthly salary" : "paid per delivery"})`, M, y, { font: bold });
  text(`Period: ${s.from} to ${s.to}`, W - M, y, { right: true, color: GRAY });
  y -= 14;
  text(`Amounts in ${currency}`, W - M, y, { right: true, color: GRAY });
  y -= 20;
  rule(y + 6);

  const row = (label: string, value: string, o: { strong?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    text(label, M, y, { font: o.strong ? bold : font, color: o.color });
    text(value, W - M, y, { font: o.strong ? bold : font, right: true, color: o.color });
    y -= 15;
  };
  row("Opening balance (owed to the rider)", money(s.opening_balance));
  row(`Delivery pay (${s.deliveries} deliver${s.deliveries === 1 ? "y" : "ies"})`, money(s.delivery_pay));
  if (s.salary > 0) row("Salary", money(s.salary));
  if (s.bonus > 0) row("Bonus", money(s.bonus));
  row("Cash collected from customers", `-${money(s.cash_collected)}`);
  row("Cash handed in to FasTrack", money(s.cash_handed_in));
  row("Paid to the rider (incl. advances)", `-${money(s.paid_out)}`);
  if (s.deductions > 0) row("Deductions", `-${money(s.deductions)}`);
  rule(y + 10);
  y -= 2;
  row(s.closing_balance >= 0 ? "Closing balance (FasTrack owes the rider)" : "Closing balance (the rider owes FasTrack)", money(Math.abs(s.closing_balance)), { strong: true, color: BLUE });
  y -= 18;

  text(`Deliveries in the period (${s.delivery_rows.length})`, M, y, { font: bold, size: 11 });
  y -= 16;
  const cols = { order: M, date: M + 100, pay: M + 330, cash: W - M };
  const head = () => {
    text("Order", cols.order, y, { size: 8.5, font: bold, color: GRAY });
    text("Delivered", cols.date, y, { size: 8.5, font: bold, color: GRAY });
    text("Delivery pay", cols.pay, y, { size: 8.5, font: bold, color: GRAY, right: true });
    text("Cash collected", cols.cash, y, { size: 8.5, font: bold, color: GRAY, right: true });
    y -= 6;
    rule(y);
    y -= 12;
  };
  head();
  for (const d of s.delivery_rows) {
    if (y < M + 70) {
      newPage();
      head();
    }
    text(d.order_number, cols.order, y);
    text(d.delivered_at ? d.delivered_at.slice(0, 10) : "-", cols.date, y, { color: GRAY });
    text(money(d.pay), cols.pay, y, { right: true });
    text(d.cash > 0 ? money(d.cash) : "-", cols.cash, y, { right: true, color: d.cash > 0 ? DARK : GRAY });
    y -= 14;
  }
  if (s.delivery_rows.length === 0) {
    text("No deliveries in this period.", M, y, { color: GRAY });
    y -= 14;
  }

  y -= 14;
  if (y < M + 80) newPage();
  text(`Payments, salary, bonuses and deductions (${s.entry_rows.length})`, M, y, { font: bold, size: 11 });
  y -= 16;
  if (s.entry_rows.length === 0) text("Nothing recorded in this period.", M, y, { color: GRAY });
  for (const e of s.entry_rows) {
    if (y < M + 30) newPage();
    text(e.date.slice(0, 10), M, y, { color: GRAY });
    text(`${ENTRY_KIND_LABEL[e.kind] ?? e.kind}${e.note ? `  ${e.note}` : ""}`, M + 80, y);
    text(money(e.amount), W - M, y, { right: true, font: bold });
    y -= 14;
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) => pg.drawText(latin1(`${companyName} rider statement   page ${i + 1} of ${pages.length}`), { x: M, y: 20, size: 8, font, color: GRAY }));
  return pdf.save();
}
