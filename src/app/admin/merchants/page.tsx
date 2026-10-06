import { createClient } from "@/lib/supabase/server";
import AddMerchantForm from "@/components/admin/AddMerchantForm";
import MerchantsList, { type MerchantRow } from "@/components/admin/MerchantsList";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { describeStatus, getOpenStatus } from "@/lib/store-hours";
import { getCurrentTenant } from "@/lib/tenant-server";
import { marketOffsetMinutes } from "@/lib/timezone";

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export default async function AdminMerchantsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const [{ data: stores }, { data: products }] = await Promise.all([
    supabase.from("stores").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("store_id").eq("is_active", true),
  ]);

  const productsByStore = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.store_id) productsByStore.set(p.store_id, (productsByStore.get(p.store_id) ?? 0) + 1);
  }

  const offset = marketOffsetMinutes((await getCurrentTenant())?.country_code);
  const merchants: MerchantRow[] = (stores ?? []).map((s) => {
    const open =
      s.status === "approved"
        ? describeStatus(getOpenStatus(s.opening_hours ?? null, s.accepting_orders ?? true, new Date(), offset), locale, t)
        : null;
    return {
    id: s.id,
    name: s.name,
    crNumber: s.cr_number,
    contactPhone: s.contact_phone,
    city: s.city,
    country: s.country ?? "Saudi Arabia",
    status: s.status,
    productCount: productsByStore.get(s.id) ?? 0,
    createdAt: s.created_at,
    logoUrl: s.logo_url ?? null,
    openText: open?.text ?? null,
    isOpen: open?.open ?? null,
    };
  });

  const pending = merchants.filter((m) => m.status === "pending").length;
  const approved = merchants.filter((m) => m.status === "approved").length;
  const countryCount = new Set(merchants.map((m) => m.country)).size;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            🏪
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.merchants_title")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.merchants_subtitle")}</p>
          </div>
        </div>
        <AddMerchantForm />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🏪" label={t("admin.total_merchants")} value={merchants.length} accent="#2563eb" />
        <Stat icon="⏳" label={t("admin.pending_review")} value={pending} accent="#d97706" />
        <Stat icon="✅" label={t("admin.approved")} value={approved} accent="#059669" />
        <Stat icon="🌍" label={t("admin.countries")} value={countryCount} accent="#7c3aed" />
      </div>

      <MerchantsList merchants={merchants} />
    </div>
  );
}
