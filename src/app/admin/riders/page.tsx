import { getAllRiders } from "@/lib/rider";
import AddRiderForm from "@/components/admin/AddRiderForm";
import RidersList, { type RiderRow } from "@/components/admin/RidersList";
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

export default async function AdminRidersPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const allRiders = await getAllRiders();

  const riders: RiderRow[] = allRiders.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    vehicleType: r.vehicle_type,
    licenseNumber: r.license_number,
    status: r.status,
    isAvailable: r.is_available,
    createdAt: r.created_at,
  }));

  const pending = riders.filter((r) => r.status === "pending").length;
  const approved = riders.filter((r) => r.status === "approved").length;
  const online = riders.filter((r) => r.status === "approved" && r.isAvailable).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            🛵
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.riders_title")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.riders_subtitle")}</p>
          </div>
        </div>
        <AddRiderForm />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🛵" label={t("admin.total_riders")} value={riders.length} accent="#2563eb" />
        <Stat icon="⏳" label={t("admin.pending_review")} value={pending} accent="#d97706" />
        <Stat icon="✅" label={t("admin.approved")} value={approved} accent="#059669" />
        <Stat icon="🟢" label={t("admin.online_now")} value={online} accent="#7c3aed" />
      </div>

      <RidersList riders={riders} />
    </div>
  );
}
