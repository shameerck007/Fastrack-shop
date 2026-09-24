import Link from "next/link";
import { getRiderProfile, getRiderTodayStats } from "@/lib/rider";
import { signOut } from "@/lib/actions/auth";
import { formatSAR } from "@/lib/utils";
import AvailabilityToggle from "@/components/rider/AvailabilityToggle";

export default async function RiderHeader() {
  const [rider, stats] = await Promise.all([getRiderProfile(), getRiderTodayStats()]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/rider" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg shadow-sm">
            🛵
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{rider?.profile.full_name ?? "Rider"}</p>
            <p className="text-xs text-neutral-400">
              {stats.deliveries} today · {formatSAR(stats.earnings)}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {rider && <AvailabilityToggle isAvailable={rider.deliveryPartner.is_available} />}
          <form action={signOut}>
            <button className="text-xs text-neutral-400 hover:text-white">Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
