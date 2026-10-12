"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import Select from "@/components/ui/Select";
import { Field, inputClass } from "@/components/ui/Form";
import { useMoney } from "@/components/MoneyProvider";
import { assignReturnRider, reviewReturn } from "@/lib/actions/returns";
import { unwrapAction } from "@/lib/errors";
import { RETURN_STATUS, reasonLabel, type ReturnRow, type ReturnStatus } from "@/lib/returns";

export interface AdminReturn extends ReturnRow {
  product_name: string;
  variant_label: string | null;
  line_total: number;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  rider_name: string | null;
}
export interface RiderOption {
  id: string;
  name: string;
}

const FILTERS: { id: string; label: string; match: (s: ReturnStatus) => boolean }[] = [
  { id: "action", label: "Needs action", match: (s) => s === "requested" || s === "approved" },
  { id: "collecting", label: "Being collected", match: (s) => s === "pickup_assigned" || s === "picked_up" },
  { id: "done", label: "Refunded", match: (s) => s === "refunded" },
  { id: "closed", label: "Rejected or cancelled", match: (s) => s === "rejected" || s === "cancelled" },
  { id: "all", label: "All", match: () => true },
];

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Approve, reject or hand over to a rider. */
function ReviewDialog({ ret, riders, onClose }: { ret: AdminReturn; riders: RiderOption[]; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pickup" | "keep" | "reject">("pickup");
  const [note, setNote] = useState("");
  const [refundDelivery, setRefundDelivery] = useState(ret.refund_delivery);
  async function save(): Promise<string | void> {
    if (mode === "reject" && !note.trim()) return "Tell the customer why the return is not accepted.";
    await unwrapAction(reviewReturn)(ret.order_id, ret.id, { approve: mode !== "reject", resolution: mode === "keep" ? "keep" : "pickup", refundDelivery, note });
    router.refresh();
  }
  const opts: [typeof mode, string, string][] = [
    ["pickup", "Approve: a rider collects it", "The customer is refunded when the rider collects the item."],
    ["keep", "Approve: customer keeps it", "Refund now, no collection. Good for cheap or hard-to-return items."],
    ["reject", "Reject", "The customer is told why."],
  ];
  return (
    <FormDialog icon="↩️" title={`Return ${ret.return_number}`} subtitle={`${ret.product_name} × ${ret.quantity} · order #${ret.order_number}`} saveLabel={mode === "reject" ? "Reject return" : "Approve return"} onClose={onClose} onSave={save}>
      <DialogSection cols={1}>
        <div className="grid gap-2">
          {opts.map(([id, title, hint]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${mode === id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200"}`}>
              <input type="radio" name="mode" checked={mode === id} onChange={() => setMode(id)} className="mt-0.5 h-4 w-4 accent-blue-700" />
              <span>
                <span className="block font-bold text-neutral-900">{title}</span>
                <span className="block text-xs text-neutral-500">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </DialogSection>
      {mode !== "reject" && (
        <DialogSection cols={1}>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={refundDelivery} onChange={(e) => setRefundDelivery(e.target.checked)} className="h-4 w-4 accent-blue-700" />
            Also refund the delivery fee (when the fault was ours)
          </label>
        </DialogSection>
      )}
      <DialogSection cols={1}>
        <Field label={mode === "reject" ? "Reason (shown to the customer)" : "Note (optional)"} required={mode === "reject"}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
      </DialogSection>
      {riders.length === 0 && mode === "pickup" && <p className="px-1 text-xs text-amber-700">No approved riders yet. You can assign one after approving.</p>}
    </FormDialog>
  );
}

function AssignDialog({ ret, riders, onClose }: { ret: AdminReturn; riders: RiderOption[]; onClose: () => void }) {
  const router = useRouter();
  const [rider, setRider] = useState(ret.rider_id ?? "");
  async function save(): Promise<string | void> {
    if (!rider) return "Choose a rider.";
    await unwrapAction(assignReturnRider)(ret.order_id, ret.id, rider);
    router.refresh();
  }
  return (
    <FormDialog icon="🛵" title="Send a rider" subtitle={`Collect ${ret.product_name} × ${ret.quantity} from ${ret.customer_name}`} saveLabel="Assign rider" onClose={onClose} onSave={save}>
      <DialogSection cols={1}>
        <Field label="Rider" required>
          <Select value={rider} onChange={(e) => setRider(e.target.value)} className="w-full">
            <option value="">Choose a rider</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-neutral-500">The rider sees it under Return pickups and confirms with the customer&apos;s code. The refund is made at that moment.</p>
      </DialogSection>
    </FormDialog>
  );
}

export default function ReturnsBoard({ rows, riders }: { rows: AdminReturn[]; riders: RiderOption[] }) {
  const money = useMoney();
  const [filter, setFilter] = useState("action");
  const [q, setQ] = useState("");
  const [review, setReview] = useState<AdminReturn | null>(null);
  const [assign, setAssign] = useState<AdminReturn | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => f.match(r.status)).length])), [rows]);
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const shown = rows.filter((r) => active.match(r.status) && (!q.trim() || [r.return_number, r.order_number, r.product_name, r.customer_name].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === f.id ? "bg-blue-700 text-white shadow-sm" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"}`}>
              {f.label} <span className={filter === f.id ? "text-blue-100" : "text-neutral-400"}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search return, order, item or customer" className="h-9 w-full rounded-full border border-neutral-300 bg-white px-4 text-sm sm:w-72" />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-3xl">↩️</p>
          <p className="mt-2 text-sm font-semibold text-neutral-800">Nothing here</p>
          <p className="text-xs text-neutral-500">Returns that customers raise appear here for review.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((r) => {
            const s = RETURN_STATUS[r.status];
            return (
              <li key={r.id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-neutral-900">
                      {r.product_name} × {r.quantity}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.return_number} · order{" "}
                      <Link href={`/admin/orders/${r.order_id}`} className="text-blue-600 hover:underline">
                        #{r.order_number}
                      </Link>{" "}
                      · {when(r.created_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${s.tone}`}>{s.label}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-700">
                  <span className="font-semibold">{reasonLabel(r.reason)}</span>
                  {r.details ? `: ${r.details}` : ""}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {r.customer_name}
                  {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                  {r.rider_name ? ` · rider ${r.rider_name}` : ""}
                </p>
                {r.photos.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((p) => (
                      <a key={p} href={p} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt="Return photo" className="h-14 w-14 rounded-lg border border-neutral-200 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {r.admin_note && <p className="mt-2 text-xs text-neutral-500">Note: {r.admin_note}</p>}
                {r.status === "refunded" && r.refund_amount != null && <p className="mt-2 text-sm font-bold text-emerald-700">{money(Number(r.refund_amount))} refunded</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "requested" && (
                    <button type="button" onClick={() => setReview(r)} className="h-9 rounded-full bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">
                      Review
                    </button>
                  )}
                  {(r.status === "approved" || r.status === "pickup_assigned") && r.resolution === "pickup" && (
                    <button type="button" onClick={() => setAssign(r)} className="h-9 rounded-full bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">
                      {r.status === "approved" ? "Send a rider" : "Change rider"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {review && <ReviewDialog ret={review} riders={riders} onClose={() => setReview(null)} />}
      {assign && <AssignDialog ret={assign} riders={riders} onClose={() => setAssign(null)} />}
    </div>
  );
}
