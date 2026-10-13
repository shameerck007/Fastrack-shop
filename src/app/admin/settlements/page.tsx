import { getAdminSettlementOverview, getAdminMonthly } from "@/lib/settlements";
import AdminSettlementsOverview from "@/components/admin/AdminSettlementsOverview";

export const metadata = { title: "Supplier ledger" };

export default async function AdminSettlementsPage() {
  const [rows, monthly] = await Promise.all([getAdminSettlementOverview(), getAdminMonthly().catch(() => null)]);
  return <AdminSettlementsOverview rows={rows} monthly={monthly} />;
}
