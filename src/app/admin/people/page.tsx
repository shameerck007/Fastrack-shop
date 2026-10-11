import Link from "@/components/Link";
import { PageHeader } from "@/components/admin/AdminUi";
import PeopleToolbar from "@/components/admin/PeopleToolbar";
import { getPeople, getPeopleCounts, type PersonRow } from "@/lib/admin-people";
import { ROLES, roleInfo } from "@/lib/people-roles";

export const metadata = { title: "Users & roles" };

const PAGE_SIZE = 25;

function manageHref(p: PersonRow): { href: string; label: string } | null {
  switch (p.role) {
    case "customer":
      return { href: `/admin/customers/${p.id}`, label: "Open customer" };
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

export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const role = sp.role && ROLES.some((r) => r.value === sp.role) ? sp.role : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const [result, counts] = await Promise.all([getPeople({ role, q: sp.q, page, pageSize: PAGE_SIZE }), getPeopleCounts()]);
  const visibleRoles = ROLES.filter((r) => counts[r.value] != null || ["customer", "merchant", "rider", "store_staff"].includes(r.value));
  const all = Object.values(counts).reduce((n, v) => n + Number(v), 0);

  const tab = (value: string, label: string, n: number | null, icon: string) => {
    const active = role === value;
    return (
      <Link
        key={value}
        href={value === "all" ? "/admin/people" : `/admin/people?role=${value}`}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${active ? "bg-blue-700 text-white shadow" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-blue-50"}`}
      >
        <span aria-hidden>{icon}</span>
        {label}
        {n != null && <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/25" : "bg-neutral-100 text-neutral-500"}`}>{n}</span>}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🛡️" title="Users & roles" subtitle="Every account type in one place: customers, suppliers, riders and store staff. Open one to manage it. Contact details are masked." />

      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {tab("all", "All", all, "👥")}
        {visibleRoles.map((r) => tab(r.value, r.label, counts[r.value] ?? 0, r.icon))}
      </div>

      {result === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Users and roles aren&apos;t set up in the database yet. Run migration <b>0076_admin_people.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      ) : "error" in result ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">The users could not be loaded: {result.error}</p>
      ) : (
        <>
          <PeopleToolbar q={sp.q ?? ""} page={page} pageSize={PAGE_SIZE} total={result.total} />
          {result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <span className="text-4xl">👥</span>
              <p className="font-semibold text-neutral-700">No accounts match</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {result.items.map((p) => {
                const info = roleInfo(p.role);
                const manage = manageHref(p);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600">{(p.name ?? "?").trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="min-w-[10rem] flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-neutral-900">{p.name ?? "No name"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.tone}`}>
                          {info.icon} {info.single}
                        </span>
                        {p.blocked && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Blocked</span>}
                      </p>
                      <p className="truncate font-mono text-xs text-neutral-500">
                        {p.phone_masked ?? "—"} · {p.email_masked ?? "—"}
                      </p>
                      {(p.store_name || p.warehouse_name) && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                          {p.role === "merchant" && p.store_name ? `🏪 ${p.store_name}` : p.warehouse_name ? `📦 ${p.warehouse_name}` : null}
                          {p.role === "merchant" && p.store_status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STORE_STATUS[p.store_status] ?? "bg-neutral-100 text-neutral-600"}`}>{p.store_status}</span>}
                        </p>
                      )}
                    </div>
                    <span className="hidden text-xs text-neutral-400 sm:block">Joined {new Date(p.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {manage ? (
                      <Link href={manage.href} className="ms-auto h-9 shrink-0 rounded-full border border-neutral-300 px-4 text-xs font-bold leading-9 text-neutral-700 hover:bg-blue-50">
                        {manage.label}
                      </Link>
                    ) : (
                      <span className="ms-auto text-xs text-neutral-300">{p.role === "admin" || p.role === "super_admin" ? "Platform account" : "—"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
