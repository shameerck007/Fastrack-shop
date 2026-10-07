import Link from "@/components/Link";
import SearchBar from "@/components/SearchBar";
import Wordmark from "@/components/Wordmark";
import UserHeaderActions from "@/components/UserHeaderActions";
import DeliverToChip from "@/components/DeliverToChip";
import CategoryNavBar from "@/components/CategoryNavBar";
import MarketPill from "@/components/MarketPill";
import LockedMarketPill from "@/components/LockedMarketPill";
import { getCategoriesWithChildren } from "@/lib/catalog";
import { getActiveTenants, getCurrentTenant, isMarketPinnedAccount } from "@/lib/tenant-server";

export default async function Header() {
  const categories = await getCategoriesWithChildren();
  const [tenants, currentTenant, pinned] = await Promise.all([
    getActiveTenants().catch(() => []),
    getCurrentTenant().catch(() => null),
    isMarketPinnedAccount(),
  ]);

  return (
    // Installed as a standalone PWA (see manifest.ts), the header sits right
    // under the OS status bar / iOS notch with no browser chrome of its own
    // in between — without this padding the logo and top row get cropped or
    // sit flush against the notch on Android/iOS. env(...) is 0 in a normal
    // browser tab, so this is a no-op there.
    <header className="sticky top-0 z-30 bg-white shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-2.5 pt-2 md:flex-nowrap md:py-3">
        <Link href="/" className="flex shrink-0 items-center gap-1.5">
          <Wordmark height={14} />
          <span className="inline-block rounded bg-blue-50 px-1 py-px text-[9px] font-semibold text-blue-700">Shop</span>
        </Link>

        <DeliverToChip variant="plain" className="min-w-0 flex-1 basis-0 justify-end sm:hidden" />
        <DeliverToChip variant="stack" className="hidden shrink-0 sm:flex" />

        {/* One search box: full width under the top row on phones, in the middle of the bar on desktop. */}
        <div className="order-last w-full md:order-none md:w-auto md:min-w-0 md:flex-1">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:ms-0 sm:gap-3">
          {currentTenant && tenants.length > 1 && (pinned ? <LockedMarketPill tenant={currentTenant} /> : <MarketPill tenants={tenants} currentId={currentTenant.id} />)}
          <UserHeaderActions />
        </div>
      </div>

      <div className="hidden border-t border-blue-100 bg-blue-50/60 md:block">
        <CategoryNavBar categories={categories} />
      </div>
    </header>
  );
}
