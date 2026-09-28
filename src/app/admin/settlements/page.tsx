import { getAdminSettlementOverview } from "@/lib/settlements";
import { formatSAR } from "@/lib/utils";
import SettlementsList from "@/components/admin/SettlementsList";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

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

export default async function AdminSettlementsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const rows = await getAdminSettlementOverview();

  const totalNetEarned = rows.reduce((sum, r) => sum + r.netEarned, 0);
  const totalPaidOut = rows.reduce((sum, r) => sum + r.paidOut, 0);
  const totalBalanceDue = rows.reduce((sum, r) => sum + r.balanceDue, 0);
  const suppliersOwed = rows.filter((r) => r.balanceDue > 0.005).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            📒
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.supplier_settlement_ledger")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.settlement_subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🏪" label={t("admin.suppliers_with_balance")} value={suppliersOwed} accent="#d97706" />
        <Stat icon="💰" label={t("admin.net_earned_all_time")} value={formatSAR(totalNetEarned)} accent="#2563eb" />
        <Stat icon="✅" label={t("admin.paid_out_all_time")} value={formatSAR(totalPaidOut)} accent="#059669" />
        <Stat icon="⏳" label={t("admin.outstanding_balance")} value={formatSAR(totalBalanceDue)} accent="#dc2626" />
      </div>

      <SettlementsList rows={rows} />
    </div>
  );
}
