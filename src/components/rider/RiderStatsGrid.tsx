import { formatSAR } from "@/lib/utils";

function Tile({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
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
        <p className="truncate text-xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export default function RiderStatsGrid({
  todayDeliveries,
  todayEarnings,
  totalDeliveries,
  rating,
  t,
}: {
  todayDeliveries: number;
  todayEarnings: number;
  totalDeliveries: number;
  rating: number | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon="💰" label={t("rider.today_earnings")} value={formatSAR(todayEarnings)} accent="#059669" />
      <Tile icon="📦" label={t("rider.today_deliveries")} value={todayDeliveries} accent="#2563eb" />
      <Tile icon="🏆" label={t("rider.total_deliveries")} value={totalDeliveries} accent="#7c3aed" />
      <Tile icon="⭐" label={t("rider.rating_label")} value={rating != null ? rating.toFixed(1) : "—"} accent="#d97706" />
    </div>
  );
}
