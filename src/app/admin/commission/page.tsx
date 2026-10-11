import { PageHeader } from "@/components/admin/AdminUi";
import CommissionManager, { type CategoryRow, type RuleRow, type StoreOption } from "@/components/admin/CommissionManager";
import { getCompanySettings } from "@/lib/company-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Commission" };

export default async function AdminCommissionPage() {
  const supabase = await createClient();
  const loose = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown; error: { code?: string } | null }> } };
  const [{ data: categories }, { data: stores }, rulesResult, company] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id, sort_order").order("sort_order"),
    supabase.from("stores").select("id, name, commission_rate, status").eq("status", "approved").order("name"),
    loose.from("commission_rules").select("id, store_id, category_id, master_id, rate, starts_on, ends_on, is_active, note, created_at"),
    getCompanySettings(),
  ]);
  const missing = !!rulesResult.error;
  const rules = ((missing ? [] : rulesResult.data) as RuleRow[]) ?? [];
  const defaultRate = Number((company as { default_commission_rate?: number | null }).default_commission_rate ?? 15);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon="💰"
        title="Commission"
        subtitle="What FasTrack keeps from each supplier sale. Set a rate per category, add exceptions for a supplier, and suppliers see the rate before they list."
      />
      {missing && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Commission rules aren&apos;t set up in the database yet. Run migration <b>0079_commission_rules.sql</b> in the Supabase SQL editor, then reload this page. Until then every supplier uses the single rate on their settlement page.
        </p>
      )}
      <CommissionManager
        categories={(categories ?? []) as CategoryRow[]}
        stores={((stores ?? []) as { id: string; name: string; commission_rate: number }[]).map<StoreOption>((s) => ({ id: s.id, name: s.name, rate: Number(s.commission_rate) }))}
        rules={rules}
        defaultRate={defaultRate}
        disabled={missing}
      />
    </div>
  );
}
