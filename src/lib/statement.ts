import { buildXlsx } from "@/lib/xlsx-lite";

/** A supplier's settlement statement for a period (from the supplier_statement database function). Safe for browser and server. */

export interface StatementOrderRow {
  order_number: string;
  delivered_at: string | null;
  sales: number;
  refunded: number;
  commission: number;
  tax: number;
  net: number;
}
export interface StatementPayoutRow {
  date: string;
  amount: number;
  method: string;
  reference: string | null;
}
export interface Statement {
  store: { name: string; city: string | null; vat_number: string | null; cr_number: string | null };
  from: string;
  to: string;
  opening_balance: number;
  sales: number;
  refunds: number;
  commission: number;
  supplier_discounts: number;
  tax_inside: number;
  net_for_period: number;
  paid_in_period: number;
  closing_balance: number;
  orders: number;
  order_rows: StatementOrderRow[];
  payout_rows: StatementPayoutRow[];
}

const q = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** The statement as a spreadsheet file: a summary block, then the orders, then the payouts. */
export function statementCsv(s: Statement, currency: string): string {
  const lines: string[] = [];
  lines.push(`${q("Settlement statement")},${q(s.store.name)}`);
  lines.push(`${q("Period")},${q(`${s.from} to ${s.to}`)}`);
  lines.push(`${q("Currency")},${q(currency)}`);
  lines.push("");
  const sum: [string, number][] = [
    ["Opening balance", s.opening_balance],
    ["Sales (delivered orders)", s.sales],
    ["Refunds", -s.refunds],
    ["FasTrack commission", -s.commission],
    ["Discounts paid by the supplier", -s.supplier_discounts],
    ["Net for the period", s.net_for_period],
    ["Paid out in the period", -s.paid_in_period],
    ["Closing balance (owed to the supplier)", s.closing_balance],
    ["Tax (VAT / GST) inside the sales", s.tax_inside],
  ];
  for (const [k, v] of sum) lines.push(`${q(k)},${v.toFixed(2)}`);
  lines.push("");
  lines.push(["Order", "Delivered", "Sales", "Refunded", "Commission", "Tax inside", "Net to supplier"].map(q).join(","));
  for (const o of s.order_rows) lines.push([q(o.order_number), q(o.delivered_at ? o.delivered_at.slice(0, 10) : ""), o.sales.toFixed(2), o.refunded.toFixed(2), o.commission.toFixed(2), o.tax.toFixed(2), o.net.toFixed(2)].join(","));
  lines.push("");
  lines.push(["Payout date", "Amount", "Method", "Reference"].map(q).join(","));
  for (const p of s.payout_rows) lines.push([q(p.date.slice(0, 10)), p.amount.toFixed(2), q(p.method), q(p.reference)].join(","));
  return lines.join("\r\n");
}

/** The statement as an Excel workbook: a Summary sheet, an Orders sheet and a Payouts sheet. */
export function statementXlsx(s: Statement, currency: string): Uint8Array {
  const summary: (string | number | null)[][] = [
    ["Settlement statement", s.store.name],
    ["Period", `${s.from} to ${s.to}`],
    ["Currency", currency],
    [null, null],
    ["Opening balance", s.opening_balance],
    ["Sales (delivered orders)", s.sales],
    ["Refunds", -s.refunds],
    ["FasTrack commission", -s.commission],
    ["Discounts paid by the supplier", -s.supplier_discounts],
    ["Net for the period", s.net_for_period],
    ["Paid out in the period", -s.paid_in_period],
    ["Closing balance (owed to the supplier)", s.closing_balance],
    ["Tax (VAT / GST) inside the sales", s.tax_inside],
  ];
  return buildXlsx([
    { name: "Summary", rows: summary, widths: [42, 22], wrap: true },
    { name: "Orders", rows: [["Order", "Delivered", "Sales", "Refunded", "Commission", "Tax inside", "Net to supplier"], ...s.order_rows.map((o) => [o.order_number, o.delivered_at ? o.delivered_at.slice(0, 10) : "", o.sales, o.refunded, o.commission, o.tax, o.net])], widths: [16, 14, 12, 12, 12, 12, 16] },
    { name: "Payouts", rows: [["Payout date", "Amount", "Method", "Reference"], ...s.payout_rows.map((p) => [p.date.slice(0, 10), p.amount, p.method, p.reference ?? ""])], widths: [14, 12, 16, 22] },
  ]);
}
