import ReturnPickupCard, { ReturnDropoffCard, type ReturnDropoff, type ReturnPickup } from "@/components/rider/ReturnPickupCard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Return pickups · FasTrack Rider" };

export default async function RiderReturnsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("rider_return_pickups" as never);
  const list = ((data ?? []) as unknown as ReturnPickup[]) ?? [];
  const { data: dropData } = await supabase.rpc("rider_return_dropoffs" as never);
  const drops = ((dropData ?? []) as unknown as ReturnDropoff[]) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">Return pickups</h1>
        <p className="text-sm text-neutral-500">Items customers are returning. Collect them and confirm with the customer&apos;s code.</p>
      </div>
      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">No returns to collect right now.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((p) => (
            <ReturnPickupCard key={p.id} p={p} />
          ))}
        </ul>
      )}
      {drops.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Collected: take back to the store ({drops.length})</h2>
          <ul className="flex flex-col gap-3">
            {drops.map((d) => (
              <ReturnDropoffCard key={d.id} d={d} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
