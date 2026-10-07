import { requireRole } from "@/lib/auth";
import RiderHeader from "@/components/rider/RiderHeader";
import RiderBottomNav from "@/components/rider/RiderBottomNav";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  await requireRole("rider");
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-neutral-50 to-neutral-50">
      <RiderHeader />
      <div className="mx-auto max-w-2xl px-4 py-6 pb-28 md:pb-6">{children}</div>
      <RiderBottomNav />
    </div>
  );
}
