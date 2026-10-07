import { getRiderWallet, formatWhen, earningsByDay } from "@/lib/rider-wallet";
import { getRiderLifetimeStats } from "@/lib/rider";
import RiderStatsGrid from "@/components/rider/RiderStatsGrid";
import { getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Trips · FasTrack Rider" };

const STAT_LABELS: Record<string, string> = {
  "rider.today_earnings": "Earned today",
  "rider.today_deliveries": "Deliveries today",
  "rider.total_deliveries": "All deliveries",
  "rider.rating_label": "Your rating",
};

export default async function RiderHistoryPage() {
  const money = await getMoney();
  const wallet = await getRiderWallet();
  const orders = wallet?.orders ?? [];
  const tz = wallet?.timeZone ?? "Asia/Riyadh";
  const lifetime = await getRiderLifetimeStats().catch(() => null);
  const today = earningsByDay(orders, tz, 1)[0];

  return (
    <div className="flex flex-col gap-4">
      <RiderStatsGrid
        money={money}
        todayDeliveries={today.deliveries}
        todayEarnings={today.earnings}
        totalDeliveries={lifetime?.totalDeliveries ?? orders.length}
        rating={lifetime?.rating ?? null}
        t={(k) => STAT_LABELS[k] ?? k}
      />

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          Your completed deliveries will be listed here.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <li key={o.orderId} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-neutral-900">#{o.orderNumber}</p>
                  <p className="text-xs text-neutral-500">{formatWhen(o.deliveredAt, tz)}</p>
                </div>
                <div className="text-end">
                  <p className="text-lg font-extrabold text-blue-700">+{money(o.deliveryFee)}</p>
                  <p className="text-[11px] text-neutral-400">your earning</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">Order value {money(o.orderTotal)}</span>
                {o.cashCollected > 0 ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">💵 Cash collected {money(o.cashCollected)}</span>
                ) : (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">✓ Paid online</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
