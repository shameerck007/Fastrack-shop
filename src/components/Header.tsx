import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import Wordmark from "@/components/Wordmark";
import UserHeaderActions from "@/components/UserHeaderActions";
import DeliverToChip from "@/components/DeliverToChip";
import CategoryNavBar from "@/components/CategoryNavBar";
import { getCategoriesWithChildren } from "@/lib/catalog";

export default async function Header() {
  const categories = await getCategoriesWithChildren();

  return (
    // Installed as a standalone PWA (see manifest.ts), the header sits right
    // under the OS status bar / iOS notch with no browser chrome of its own
    // in between — without this padding the logo and top row get cropped or
    // sit flush against the notch on Android/iOS. env(...) is 0 in a normal
    // browser tab, so this is a no-op there.
    <header className="sticky top-0 z-30 bg-white shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-2.5 pt-2 sm:gap-3 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <Wordmark height={17} />
            <span className="inline-block rounded bg-blue-50 px-1 py-px text-[10px] font-semibold text-blue-700">Shop</span>
          </Link>

          <DeliverToChip variant="plain" className="ms-auto min-w-0 sm:hidden" />
          <DeliverToChip className="hidden sm:flex" />

          <div className="flex shrink-0 items-center gap-3">
            <UserHeaderActions />
          </div>
        </div>

        <SearchBar />
      </div>

      <div className="hidden border-t border-blue-100 bg-blue-50/60 md:block">
        <CategoryNavBar categories={categories} />
      </div>
    </header>
  );
}
