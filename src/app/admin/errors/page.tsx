import { PageHeader } from "@/components/admin/AdminUi";
import ErrorLogView, { type ErrorRow } from "@/components/admin/ErrorLogView";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "System errors" };

/** How many of the rows are from the last day. */
function countRecent(rows: ErrorRow[]): number {
  const cutoff = Date.now() - 86_400_000;
  return rows.filter((r) => new Date(r.created_at).getTime() > cutoff).length;
}

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  // The error log is not in the generated types until its migration is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("error_log").select("id, ref, area, path, message, detail, created_at, user_id").order("created_at", { ascending: false }).limit(300);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🐞" title="System errors" subtitle="Problems people ran into, with the reference code they were shown. Search a code to find exactly what happened." />
      {error ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          The error log needs database migration <b>0088_error_log.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      ) : (
        <ErrorLogView rows={(data ?? []) as ErrorRow[]} last24h={countRecent((data ?? []) as ErrorRow[])} />
      )}
    </div>
  );
}
