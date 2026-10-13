import Link from "@/components/Link";
import type { PersonRow } from "@/lib/admin-people";
import { roleInfo } from "@/lib/people-roles";

function manageHref(p: PersonRow): { href: string; label: string } | null {
  switch (p.role) {
    case "customer":
      return { href: `/admin/users?role=customer&selected=${p.id}`, label: "Open" };
    case "merchant":
      return p.store_id ? { href: `/admin/merchants/${p.store_id}`, label: "Manage supplier" } : null;
    case "rider":
      return { href: `/admin/riders/${p.id}`, label: "Manage rider" };
    case "store_staff":
      return p.warehouse_id ? { href: `/admin/store/${p.warehouse_id}`, label: "Open store" } : null;
    default:
      return null;
  }
}

const STORE_STATUS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

/** The accounts table: User, Type, Contact (masked), Status, Joined and the action to manage each one. Becomes cards on phones. */
export default function PeopleTable({ items }: { items: PersonRow[] }) {
  return (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_9rem_minmax(0,1.6fr)_7.5rem_7rem_8.5rem] items-center gap-4 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 lg:grid">
                <span>User</span>
                <span>Type</span>
                <span>Contact (masked)</span>
                <span>Status</span>
                <span>Joined</span>
                <span className="text-end">Action</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {items.map((p) => {
                  const info = roleInfo(p.role);
                  const manage = manageHref(p);
                  const status = p.blocked
                    ? { label: "Blocked", tone: "bg-red-50 text-red-700" }
                    : p.role === "merchant" && p.store_status
                      ? { label: p.store_status, tone: STORE_STATUS[p.store_status] ?? "bg-neutral-100 text-neutral-600" }
                      : p.role === "rider" && p.rider_status
                        ? { label: p.rider_status, tone: STORE_STATUS[p.rider_status] ?? "bg-neutral-100 text-neutral-600" }
                        : { label: "Active", tone: "bg-emerald-50 text-emerald-700" };
                  const sub = p.role === "merchant" && p.store_name ? `🏪 ${p.store_name}` : p.warehouse_name ? `📦 ${p.warehouse_name}` : null;
                  return (
                    <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-neutral-50/70 lg:grid-cols-[minmax(0,2.2fr)_9rem_minmax(0,1.6fr)_7.5rem_7rem_8.5rem] lg:gap-x-4">
                      {/* user */}
                      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${info.tone}`}>{(p.name ?? "?").trim().charAt(0).toUpperCase() || "?"}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-neutral-900">{p.name ?? "No name"}</span>
                          <span className="block truncate text-xs text-neutral-500">{sub ?? `${info.single} account`}</span>
                        </span>
                      </div>

                      {/* action (top right on phones) */}
                      <div className="row-start-1 flex justify-end lg:order-last lg:row-auto">
                        {manage ? (
                          <Link href={manage.href} className="inline-flex h-9 items-center rounded-full border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                            {manage.label}
                          </Link>
                        ) : (
                          <span className="text-xs text-neutral-300">{p.role === "admin" || p.role === "super_admin" ? "Platform" : "—"}</span>
                        )}
                      </div>

                      {/* type */}
                      <div className="col-span-3 flex flex-wrap items-center gap-1.5 lg:col-span-1">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${info.tone}`}>
                          {info.icon} {info.single}
                        </span>
                        {p.rider_status && p.role !== "rider" && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">🛵 Rider {p.rider_status}</span>}
                      </div>

                      {/* contact */}
                      <div className="col-span-3 min-w-0 font-mono text-xs leading-5 text-neutral-500 lg:col-span-1">
                        <span className="block truncate">{p.phone_masked ?? "—"}</span>
                        <span className="block truncate">{p.email_masked ?? "—"}</span>
                      </div>

                      {/* status + joined */}
                      <div className="col-span-3 flex items-center justify-between gap-3 lg:col-span-1 lg:justify-start">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${status.tone}`}>{status.label}</span>
                        <span className="text-xs text-neutral-500 lg:hidden">Joined {new Date(p.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <span className="hidden text-xs text-neutral-500 lg:block">{new Date(p.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
  );
}
