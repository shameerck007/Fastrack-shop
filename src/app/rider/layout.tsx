import { requireRole } from "@/lib/auth";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  await requireRole("rider");
  return <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>;
}
