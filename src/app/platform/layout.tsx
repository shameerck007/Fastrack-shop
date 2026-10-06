import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import Wordmark from "@/components/Wordmark";
import PlatformNav from "@/components/platform/PlatformNav";

/** The platform owner's control center: every market side by side, each in its own currency. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("super_admin");

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-neutral-50 to-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/platform" className="flex shrink-0 items-center gap-2">
            <Wordmark height={24} />
            <span className="rounded-md bg-blue-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Platform</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
            <Link href="/admin" className="text-neutral-500 hover:text-neutral-900">
              <span className="hidden sm:inline">Market admin view</span>
              <span className="sm:hidden">Admin</span>
            </Link>
            <Link href="/api/enter-shop" prefetch={false} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900">
              <span className="rtl:-scale-x-100">←</span> <span className="hidden sm:inline">Back to shop</span>
            </Link>
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline">● {profile.full_name ?? "Platform owner"}</span>
            <form action={signOut}>
              <button className="text-neutral-500 hover:text-neutral-900">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:gap-6 md:py-6">
        <aside className="shrink-0 md:sticky md:top-20 md:w-60 md:self-start">
          <PlatformNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
