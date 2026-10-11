import Link from "@/components/Link";
import { PageHeader } from "@/components/admin/AdminUi";
import CustomersToolbar from "@/components/admin/CustomersToolbar";
import CustomerDetailView from "@/components/admin/CustomerDetailView";
import PeopleToolbar from "@/components/admin/PeopleToolbar";
import PeopleTable from "@/components/admin/PeopleTable";
import RidersPanel from "@/components/admin/RidersPanel";
import { getCustomers } from "@/lib/admin-customers";
import { getPeople, getPeopleCounts } from "@/lib/admin-people";
import { ROLES } from "@/lib/people-roles";
import { getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Users" };

const PAGE_SIZE = 25;

type SP = { role?: string; q?: string; page?: string; filter?: string; selected?: string };

function ago(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const role = sp.role && ROLES.some((r) => r.value === sp.role) ? sp.role : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const counts = await getPeopleCounts();
  const visibleRoles = ROLES.filter((r) => counts[r.value] != null || ["customer", "merchant", "rider", "store_staff"].includes(r.value));
  const all = counts.all ?? Object.values(counts).reduce((n, v) => n + Number(v), 0);

  const tab = (value: string, label: string, n: number, icon: string) => {
    const active = role === value;
    return (
      <Link
        key={value}
        href={value === "all" ? "/admin/users" : `/admin/users?role=${value}`}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${active ? "bg-blue-700 text-white shadow" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-blue-50"}`}
      >
        <span aria-hidden>{icon}</span>
        {label}
        <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/25" : "bg-neutral-100 text-neutral-500"}`}>{n}</span>
      </Link>
    );
  };

  const header = (
    <>
      <PageHeader
        icon="👥"
        title="Users"
        subtitle="Customers, suppliers, riders and staff in one place. Pick a type, search, and open an account to manage it. Contact details are masked."
        actions={
          role === "merchant" ? (
            <Link href="/admin/merchants" className="inline-flex h-10 items-center rounded-full bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">
              Add or approve suppliers
            </Link>
          ) : undefined
        }
      />
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {tab("all", "All", all, "👥")}
        {visibleRoles.map((r) => tab(r.value, r.label, counts[r.value] ?? 0, r.icon))}
      </div>
    </>
  );

  // ---------------- riders: the full rider management
  if (role === "rider") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <RidersPanel />
      </div>
    );
  }

  // ---------------- customers: list on the left, the selected customer on the right
  if (role === "customer") {
    const money = await getMoney();
    const result = await getCustomers({ q: sp.q, filter: sp.filter, page, pageSize: 20 });
    const selected = sp.selected ?? null;
    const hrefFor = (id: string) => {
      const u = new URLSearchParams({ role: "customer", selected: id });
      if (sp.q) u.set("q", sp.q);
      if (sp.filter) u.set("filter", sp.filter);
      if (sp.page) u.set("page", sp.page);
      return `/admin/users?${u}`;
    };
    const backHref = `/admin/users?${new URLSearchParams({ role: "customer", ...(sp.q ? { q: sp.q } : {}), ...(sp.filter ? { filter: sp.filter } : {}), ...(sp.page ? { page: sp.page } : {}) })}`;

    return (
      <div className="flex flex-col gap-4">
        {header}
        {result === null ? (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            Customer management isn&apos;t set up in the database yet. Run migration <b>0075_admin_customers.sql</b> in the Supabase SQL editor, then reload this page.
          </p>
        ) : "error" in result ? (
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">The customers could not be loaded: {result.error}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className={`flex min-w-0 flex-col gap-3 ${selected ? "hidden lg:flex" : ""}`}>
              <CustomersToolbar q={sp.q ?? ""} filter={sp.filter ?? "all"} page={page} pageSize={20} total={result.total} />
              {result.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
                  <span className="text-3xl">👥</span>
                  <p className="font-semibold text-neutral-700">No customers match</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    <span>Customer</span>
                    <span>Spent · orders</span>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {result.items.map((c) => (
                      <li key={c.id}>
                        <Link href={hrefFor(c.id)} className={`relative flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50 ${selected === c.id ? "bg-blue-50/70" : ""}`}>
                          {selected === c.id && <span aria-hidden className="absolute inset-y-0 start-0 w-1 rounded-e bg-blue-600" />}
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-800">{(c.name ?? "?").trim().charAt(0).toUpperCase() || "?"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-bold text-neutral-900">{c.name ?? "No name"}</span>
                              {c.blocked && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Blocked</span>}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-neutral-500">{c.phone_masked ?? c.email_masked ?? "—"}</span>
                            <span className="block truncate text-[11px] text-neutral-400">
                              {c.city ?? "No address yet"} · last order {ago(c.last_order_at).toLowerCase()}
                            </span>
                          </span>
                          <span className="shrink-0 text-end leading-tight">
                            <b className="block text-sm text-neutral-900">{money(Number(c.spent))}</b>
                            <span className="text-[11px] text-neutral-500">
                              {c.orders} {c.orders === 1 ? "order" : "orders"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
              {selected ? (
                <CustomerDetailView key={selected} id={selected} backHref={backHref} />
              ) : (
                <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
                  <span className="text-4xl">👈</span>
                  <p className="font-semibold text-neutral-700">Select a customer</p>
                  <p className="max-w-xs text-sm text-neutral-500">Their orders, addresses, support notes and actions appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- everyone else: one list
  const result = await getPeople({ role, q: sp.q, page, pageSize: PAGE_SIZE });
  return (
    <div className="flex flex-col gap-4">
      {header}
      {result === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Users aren&apos;t set up in the database yet. Run migration <b>0076_admin_people.sql</b> in the Supabase SQL editor, then reload this page.
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
            <PeopleTable items={result.items} />
          )}
        </>
      )}
    </div>
  );
}
