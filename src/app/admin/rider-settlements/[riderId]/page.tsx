import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getRiderSettlementEntries,
  getRiderSettlementOrders,
  getRiderSettlementSummary,
} from "@/lib/rider-settlements";
import RiderEntryForm from "@/components/admin/RiderEntryForm";
import { checkSaudiIban, formatIban } from "@/lib/iban";
import { formatSAR } from "@/lib/utils";

function Card({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "red" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", other: "Other" };

export default async function AdminRiderSettlementDetailPage({ params }: { params: Promise<{ riderId: string }> }) {
  const { riderId } = await params;
  const supabase = await createClient();

  const { data: rider } = await supabase.from("delivery_partners").select("*").eq("id", riderId).maybeSingle();
  if (!rider) notFound();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", riderId).maybeSingle();

  let data: Awaited<ReturnType<typeof loadLedger>> | null = null;
  try {
    data = await loadLedger(riderId);
  } catch {
    data = null;
  }

  const bank = rider.payout_method === "bank" && rider.bank_iban;
  const balance = data?.summary?.balance ?? 0;

  return (
    <div>
      <Link href="/admin/rider-settlements" className="text-sm text-blue-600 hover:underline">
        ← Rider settlements
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{profile?.full_name ?? "Rider"}</h1>
          <p className="text-sm text-neutral-500">
            Payout: {rider.payout_method === "bank" ? "Bank transfer" : "Cash"} ·{" "}
            <Link href={`/admin/riders/${riderId}`} className="text-blue-600 hover:underline">
              rider profile
            </Link>
          </p>
          {bank && (
            <p className="mt-1 text-xs text-neutral-500">
              {rider.bank_name} · <span className="font-mono">{formatIban(rider.bank_iban!)}</span>
              {rider.bank_account_holder ? ` · ${rider.bank_account_holder}` : ""}
              {!checkSaudiIban(rider.bank_iban!).ok && <span className="ml-1 text-red-600">(check IBAN)</span>}
            </p>
          )}
        </div>
        {data?.summary && <RiderEntryForm riderId={riderId} balance={balance} payoutMethod={rider.payout_method ?? "cash"} />}
      </div>

      {!data?.summary ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Rider settlement isn&apos;t set up in the database yet — run migration 0041_rider_onboarding_and_settlement.sql first.
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card label="Delivery fees earned" value={formatSAR(data.summary.earned)} tone="emerald" />
            <Card label="Cash collected (COD)" value={formatSAR(data.summary.cashCollected)} />
            <Card label="Paid to rider" value={formatSAR(data.summary.paidOut)} />
            <Card label="Cash handed in" value={formatSAR(data.summary.cashDeposited)} />
            <Card
              label={balance > 0.005 ? "We owe the rider" : balance < -0.005 ? "Rider owes us" : "Balance"}
              value={balance < -0.005 ? formatSAR(-balance) : formatSAR(balance)}
              tone={balance > 0.005 ? "amber" : balance < -0.005 ? "red" : "emerald"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:col-span-2">
              <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
                Delivered orders ({data.orders.length})
              </h2>
              {data.orders.length === 0 ? (
                <p className="p-4 text-sm text-neutral-400">No delivered orders yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                        <th className="px-4 py-2.5">Order</th>
                        <th className="px-3 py-2.5">Delivered</th>
                        <th className="px-3 py-2.5 text-right">Fee earned</th>
                        <th className="px-4 py-2.5 text-right">Cash collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.orders.map((o) => (
                        <tr key={o.orderId}>
                          <td className="px-4 py-2.5 font-medium text-neutral-800">{o.orderNumber}</td>
                          <td className="px-3 py-2.5 text-neutral-500">{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString("en-US") : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-neutral-700">{formatSAR(o.deliveryFee)}</td>
                          <td className="px-4 py-2.5 text-right text-neutral-500">{o.cashCollected > 0 ? formatSAR(o.cashCollected) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
                Payments ({data.entries.length})
              </h2>
              {data.entries.length === 0 ? (
                <p className="p-4 text-sm text-neutral-400">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {data.entries.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {e.kind === "payout" ? "Paid to rider" : "Cash handed in"} · {formatSAR(e.amount)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {METHOD_LABELS[e.method] ?? e.method}
                          {e.reference && ` · Ref ${e.reference}`}
                        </p>
                        {e.note && <p className="mt-0.5 text-xs text-neutral-400">{e.note}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-neutral-400">{new Date(e.createdAt).toLocaleDateString("en-US")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

async function loadLedger(riderId: string) {
  const [summary, orders, entries] = await Promise.all([
    getRiderSettlementSummary(riderId),
    getRiderSettlementOrders(riderId),
    getRiderSettlementEntries(riderId),
  ]);
  return { summary, orders, entries };
}
