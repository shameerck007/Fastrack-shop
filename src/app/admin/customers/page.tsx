import Link from "@/components/Link";
import { PageHeader } from "@/components/admin/AdminUi";
import CustomersToolbar from "@/components/admin/CustomersToolbar";
import { getCustomers } from "@/lib/admin-customers";
import { getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 25;

function ago(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const money = await getMoney();
  const result = await getCustomers({ q: sp.q, filter: sp.filter, page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon="👥"
        title="Customers"
        subtitle="Find a customer, see their orders and help them. Phone and email are masked; every look at a customer is recorded."
      />

      {result === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Customer management isn&apos;t set up in the database yet. Run migration <b>0075_admin_customers.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      ) : "error" in result ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">The customers could not be loaded: {result.error}</p>
      ) : (
        <>
          <CustomersToolbar q={sp.q ?? ""} filter={sp.filter ?? "all"} page={page} pageSize={PAGE_SIZE} total={result.total} />

          {result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <span className="text-4xl">👥</span>
              <p className="font-semibold text-neutral-700">No customers match</p>
              <p className="text-sm text-neutral-500">Try a different search or filter.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5rem_7rem_7rem] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 md:grid">
                <span>Customer</span>
                <span>Contact (masked)</span>
                <span className="text-end">Orders</span>
                <span className="text-end">Spent</span>
                <span className="text-end">Last order</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {result.items.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/customers/${c.id}`} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-neutral-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5rem_7rem_7rem]">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{(c.name ?? "?").trim().charAt(0).toUpperCase() || "?"}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-neutral-900">{c.name ?? "No name"}</span>
                            {c.blocked && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Blocked</span>}
                          </span>
                          <span className="block truncate text-xs text-neutral-500">{c.city ?? "No address yet"}</span>
                        </span>
                      </span>
                      <span className="min-w-0 text-xs text-neutral-500 md:text-sm">
                        <span className="block truncate font-mono">{c.phone_masked ?? "—"}</span>
                        <span className="block truncate font-mono">{c.email_masked ?? "—"}</span>
                      </span>
                      <span className="text-sm font-semibold text-neutral-800 md:text-end">
                        <span className="text-xs font-normal text-neutral-400 md:hidden">Orders </span>
                        {c.orders}
                      </span>
                      <span className="text-sm font-semibold text-neutral-800 md:text-end">{money(Number(c.spent))}</span>
                      <span className="text-xs text-neutral-500 md:text-end md:text-sm">{ago(c.last_order_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
