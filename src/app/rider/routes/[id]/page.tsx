import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { getRouteForRider } from "@/lib/routes";
import { getMoney } from "@/lib/tenant-server";
import RoutePickupButton from "@/components/rider/RoutePickupButton";
import OffersPoller from "@/components/rider/OffersPoller";

export const metadata = { title: "Route · FasTrack Rider" };

const STATUS_LABEL: Record<string, string> = {
  rider_assigned: "To pick up",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function directions(lat: number | null, lng: number | null, text: string | null) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : text ?? "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

export default async function RiderRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const money = await getMoney();
  const route = await getRouteForRider(id);
  if (!route) notFound();

  const open = route.stops.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
  const cash = route.stops.reduce((n, s) => n + s.cashToCollect, 0);
  const pay = route.stops.reduce((n, s) => n + s.pay, 0);
  const toPickUp = route.stops.filter((s) => s.status === "rider_assigned").length;
  const finished = open.length === 0;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {!finished && <OffersPoller everySeconds={15} />}
      <div>
        <Link href="/rider" className="text-sm font-semibold text-blue-700">
          ← Back
        </Link>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight">Route · {route.areaLabel}</h1>
        <p className="text-sm text-neutral-500">
          {route.delivered} of {route.stops.length} delivered
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${route.stops.length ? (route.delivered / route.stops.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Route pay</p>
          <p className="text-lg font-extrabold text-blue-700">{money(pay)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Cash to collect</p>
          <p className="text-lg font-extrabold text-neutral-900">{money(cash)}</p>
        </div>
      </div>

      {/* step 1: pick up everything at the shop */}
      {toPickUp > 0 && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800/70">Step 1 · Pickup</p>
          <p className="mt-1 font-extrabold text-blue-950">{route.shopName ?? "Shop"}</p>
          {route.shopAddress && <p className="text-xs text-blue-900/70">{route.shopAddress}</p>}
          <a
            href={directions(route.shopLat, route.shopLng, route.shopAddress)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-blue-800 shadow-sm"
          >
            🧭 Directions to the shop
          </a>
          <div className="mt-3">
            <RoutePickupButton routeId={route.id} count={toPickUp} />
          </div>
        </section>
      )}

      {/* step 2: the stops, in driving order */}
      <section className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{toPickUp > 0 ? "Step 2 · Stops" : "Stops"}</p>
        {route.stops.map((s, i) => {
          const done = s.status === "delivered" || s.status === "cancelled";
          const stopNo = done ? null : open.indexOf(s) + 1;
          return (
            <div key={s.orderId} className={`rounded-3xl border bg-white p-4 shadow-sm ${done ? "border-neutral-100 opacity-70" : "border-neutral-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${done ? "bg-neutral-100 text-neutral-400" : "bg-blue-700 text-white"}`}>
                    {done ? "✓" : stopNo ?? i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-neutral-900">#{s.orderNumber}</p>
                    {s.receiverName && <p className="text-sm font-semibold text-neutral-700">{s.receiverName}</p>}
                    <p className="text-sm text-neutral-600">{s.address ?? "Address not available yet"}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">{STATUS_LABEL[s.status] ?? s.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">
                  📦 {s.itemCount} {s.itemCount === 1 ? "item" : "items"}
                </span>
                {s.cashToCollect > 0 ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">💵 Collect {money(s.cashToCollect)}</span>
                ) : (
                  !done && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">✓ Paid online</span>
                )}
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">You earn {money(s.pay)}</span>
              </div>
              {!done && (
                <div className="mt-3 flex gap-2">
                  {s.status === "out_for_delivery" && (
                    <a
                      href={directions(s.lat, s.lng, s.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 flex-1 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-bold text-neutral-800"
                    >
                      🧭 Directions
                    </a>
                  )}
                  {s.receiverPhone && (
                    <a href={`tel:${s.receiverPhone}`} className="flex h-11 flex-1 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-bold text-neutral-800">
                      📞 Call
                    </a>
                  )}
                  <Link href={`/rider/orders/${s.orderId}`} className="flex h-11 flex-[1.4] items-center justify-center rounded-full bg-blue-700 text-sm font-extrabold text-white">
                    {s.status === "out_for_delivery" ? "Deliver" : "Open"}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {finished && (
        <div className="rounded-3xl bg-blue-50 p-5 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 font-extrabold text-blue-950">Route complete</p>
          <p className="text-sm text-blue-900/70">All stops are done. Hand in any cash you collected.</p>
          <Link href="/rider/earnings" className="mt-3 inline-block rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white">
            See earnings
          </Link>
        </div>
      )}
    </div>
  );
}
