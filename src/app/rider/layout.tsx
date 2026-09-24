import { requireRole } from "@/lib/auth";
import RiderHeader from "@/components/rider/RiderHeader";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  await requireRole("rider");
  return (
    <div className="min-h-screen bg-neutral-50">
      <RiderHeader />
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
    </div>
  );
}
