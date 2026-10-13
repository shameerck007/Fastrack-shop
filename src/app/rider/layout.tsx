import PortalBreadcrumbs from "@/components/PortalBreadcrumbs";
import { requireRole } from "@/lib/auth";
import RiderHeader from "@/components/rider/RiderHeader";
import RiderBottomNav from "@/components/rider/RiderBottomNav";

export const metadata = { title: { default: "Rider", template: "%s | FasTrack Rider" } };

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  await requireRole("rider");
  return (
    <div className="min-h-screen bg-neutral-50">
      <RiderHeader />
      <div className="mx-auto max-w-2xl px-4 py-6 pb-28 md:pb-6"><PortalBreadcrumbs portal="rider">{children}</PortalBreadcrumbs></div>
      <RiderBottomNav />
    </div>
  );
}
