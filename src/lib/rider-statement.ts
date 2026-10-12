/** A rider's settlement statement for a period (from the rider_statement database function). Safe for browser and server. */

export interface RiderStatementDelivery {
  order_number: string;
  delivered_at: string | null;
  pay: number;
  cash: number;
}
export interface RiderStatementEntry {
  date: string;
  kind: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
}
export interface RiderStatement {
  rider: { name: string; pay_type: string; payout_method: string | null };
  from: string;
  to: string;
  opening_balance: number;
  deliveries: number;
  delivery_pay: number;
  salary: number;
  bonus: number;
  cash_collected: number;
  cash_handed_in: number;
  paid_out: number;
  deductions: number;
  closing_balance: number;
  delivery_rows: RiderStatementDelivery[];
  entry_rows: RiderStatementEntry[];
}

export const ENTRY_KIND_LABEL: Record<string, string> = {
  payout: "Paid to rider",
  cash_deposit: "Cash handed in",
  salary: "Monthly salary",
  bonus: "Bonus",
  advance: "Advance paid",
  deduction: "Deduction",
};

const q = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function riderStatementCsv(s: RiderStatement, currency: string): string {
  const lines: string[] = [];
  lines.push(`${q("Rider settlement statement")},${q(s.rider.name)}`);
  lines.push(`${q("Period")},${q(`${s.from} to ${s.to}`)}`);
  lines.push(`${q("Currency")},${q(currency)}`);
  lines.push("");
  const sum: [string, number][] = [
    ["Opening balance (positive: FasTrack owes the rider)", s.opening_balance],
    ["Delivery pay", s.delivery_pay],
    ["Salary", s.salary],
    ["Bonus", s.bonus],
    ["Cash collected from customers", -s.cash_collected],
    ["Cash handed in", s.cash_handed_in],
    ["Paid to the rider (incl. advances)", -s.paid_out],
    ["Deductions", -s.deductions],
    ["Closing balance", s.closing_balance],
  ];
  for (const [k, v] of sum) lines.push(`${q(k)},${v.toFixed(2)}`);
  lines.push("");
  lines.push(["Order", "Delivered", "Delivery pay", "Cash collected"].map(q).join(","));
  for (const d of s.delivery_rows) lines.push([q(d.order_number), q(d.delivered_at ? d.delivered_at.slice(0, 10) : ""), d.pay.toFixed(2), d.cash.toFixed(2)].join(","));
  lines.push("");
  lines.push(["Date", "Type", "Amount", "Method", "Reference", "Note"].map(q).join(","));
  for (const e of s.entry_rows) lines.push([q(e.date.slice(0, 10)), q(ENTRY_KIND_LABEL[e.kind] ?? e.kind), e.amount.toFixed(2), q(e.method), q(e.reference), q(e.note)].join(","));
  return lines.join("\r\n");
}
