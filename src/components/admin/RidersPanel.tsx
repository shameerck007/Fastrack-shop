import { getAllRiders } from "@/lib/rider";
import AddRiderForm from "@/components/admin/AddRiderForm";
import RidersList, { type RiderRow } from "@/components/admin/RidersList";
import { StatGrid, StatTile } from "@/components/admin/AdminUi";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

/** Rider management (numbers, applications, the list) for the Users page. */
export default async function RidersPanel() {
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
    <div className="flex flex-col gap-1">
      <StatGrid>
        <StatTile icon="🛵" label={t("admin.total_riders")} value={riders.length} accent="#2563eb" />
        <StatTile icon="⏳" label={t("admin.pending_review")} value={pending} accent="#d97706" />
        <StatTile icon="✅" label={t("admin.approved")} value={approved} accent="#059669" />
        <StatTile icon="🟢" label={t("admin.online_now")} value={online} accent="#7c3aed" />
      </StatGrid>
      <div className="flex justify-end">
        <AddRiderForm />
      </div>
      <RidersList riders={riders} />
    </div>
  );
}
