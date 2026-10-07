import { getRiderWallet, formatWhen } from "@/lib/rider-wallet";
import { getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Trips · FasTrack Rider" };

export default async function RiderHistoryPage() {
  const money = await getMoney();
  const wallet = await getRiderWallet();
  const orders = wallet?.orders ?? [];
  const tz = wallet?.timeZone ?? "Asia/Riyadh";
  const total = orders.reduce((a, o) => a + o.deliveryFee, 0);
  const cashOrders = orders.filter((o) => o.cashCollected > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: "📦", label: "Deliveries", value: String(orders.length) },
          { icon: "💰", label: "Earned", value: money(total) },
          { icon: "💵", label: "Cash orders", value: String(cashOrders) },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-neutral-200 bg-white p-3 text-center shadow-sm">
            <p className="text-xl">{x.icon}</p>
            <p className="mt-1 truncate text-base font-extrabold text-neutral-900">{x.value}</p>
            <p className="text-[11px] font-medium text-neutral-500">{x.label}</p>
          </div>
        ))}
      </div>

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
                  <p className="text-lg font-extrabold text-emerald-600">+{money(o.deliveryFee)}</p>
                  <p className="text-[11px] text-neutral-400">your earning</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">Order value {money(o.orderTotal)}</span>
                {o.cashCollected > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">💵 Cash collected {money(o.cashCollected)}</span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">✓ Paid online</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
