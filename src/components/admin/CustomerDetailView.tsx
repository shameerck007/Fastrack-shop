import Link from "@/components/Link";
import { getCustomerDetail } from "@/lib/admin-customers";
import { moneyFor } from "@/lib/money";
import { getMoney } from "@/lib/tenant-server";
import { BlockButton, ContactCard, NoteForm } from "@/components/admin/CustomerPanel";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-blue-50 text-blue-700",
  rider_assigned: "bg-blue-50 text-blue-700",
  out_for_delivery: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

const ACTION_LABELS: Record<string, string> = {
  "customer.view": "Viewed the customer",
  "customer.reveal_contact": "Revealed phone and email",
  "customer.block": "Blocked ordering",
  "customer.unblock": "Unblocked ordering",
  "customer.note": "Added a note",
};

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 text-sm font-extrabold tracking-tight text-neutral-800">{title}</h2>
      {children}
    </section>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** One customer in full: summary numbers, contact (masked), addresses, orders, notes and the super admin access log. Shown inside the Users page. */
export default async function CustomerDetailView({ id, backHref }: { id: string; backHref: string }) {
  const [c, money] = await Promise.all([getCustomerDetail(id), getMoney()]);
  if (!c) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        This customer was not found. <Link href={backHref} className="font-semibold text-blue-700 hover:underline">Back to the list</Link>
      </div>
    );
  }
  const name = c.name ?? "Customer";
  const avg = c.stats.delivered > 0 ? Number(c.stats.spent) / c.stats.delivered : 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="text-xs font-bold text-blue-700 hover:underline lg:hidden">
        ← All customers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-extrabold text-white ring-4 ring-blue-50">{name.trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-neutral-900">{name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">🛍️ Customer</span>
              {c.blocked_at ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Blocked from ordering</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Active</span>}
              <span>Joined {when(c.joined_at)}</span>
            </p>
          </div>
        </div>
        <BlockButton id={c.id} blocked={!!c.blocked_at} name={name} />
      </div>

      {c.blocked_at && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <b>Blocked {when(c.blocked_at)}.</b> {c.blocked_reason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["🧾", "Orders", c.stats.orders, "#2563eb"],
          ["💰", "Spent (delivered)", money(Number(c.stats.spent)), "#059669"],
          ["📊", "Average order", money(avg), "#7c3aed"],
          ["↩️", "Cancelled", c.stats.cancelled, "#d97706"],
        ].map(([icon, label, value, accent]) => (
          <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: `${accent}1a`, color: String(accent) }}>
              {icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-500">{label}</p>
              <p className="truncate text-lg font-bold leading-tight text-neutral-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card title="🔒 Contact">
            <ContactCard id={c.id} phoneMasked={c.phone_masked} emailMasked={c.email_masked} canReveal={c.can_reveal} />
          </Card>

          <Card title={`📍 Saved addresses (${c.addresses.length})`}>
            {c.addresses.length === 0 ? (
              <p className="text-sm text-neutral-400">No saved addresses.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 text-sm">
                {c.addresses.map((a) => (
                  <li key={a.id} className="rounded-xl bg-neutral-50 p-2.5">
                    <p className="flex items-center gap-1.5 font-semibold capitalize text-neutral-800">
                      {a.label}
                      {a.is_default && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Default</span>}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {[a.address_line, a.district, a.city].filter(Boolean).join(", ")}
                      {a.building_number ? ` · Bldg ${a.building_number}` : ""}
                      {a.unit_number ? ` · Unit ${a.unit_number}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="📝 Support notes">
            <NoteForm id={c.id} />
            {c.notes.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {c.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-amber-50/60 p-2.5 text-sm">
                    <p className="whitespace-pre-wrap text-neutral-800">{n.body}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {n.author} · {when(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title={`🧾 Orders (${c.orders.length}${c.orders.length === 50 ? "+" : ""})`}>
            {c.orders.length === 0 ? (
              <p className="text-sm text-neutral-400">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 py-2.5 hover:bg-neutral-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-neutral-900">#{o.order_number}</p>
                        <p className="text-xs text-neutral-500">{when(o.created_at)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-neutral-700">{o.currency ? moneyFor(o.currency)(Number(o.total)) : money(Number(o.total))}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-600"}`}>{o.status.replace(/_/g, " ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {c.access_log && (
            <Card title="🛡️ Access log (super admin only)">
              {c.access_log.length === 0 ? (
                <p className="text-sm text-neutral-400">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 text-sm">
                  {c.access_log.map((l, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="text-neutral-800">
                        <b>{l.actor}</b> · {ACTION_LABELS[l.action] ?? l.action}
                      </span>
                      <span className="text-xs text-neutral-400">{when(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
