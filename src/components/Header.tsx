import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import Wordmark from "@/components/Wordmark";
import UserHeaderActions from "@/components/UserHeaderActions";
import DeliverToChip from "@/components/DeliverToChip";
import CategoryNavBar from "@/components/CategoryNavBar";
import LanguageToggle from "@/components/LanguageToggle";
import { getCategoriesWithChildren } from "@/lib/catalog";

export default async function Header() {
  const categories = await getCategoriesWithChildren();

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark height={26} />
            <span className="hidden rounded-md bg-blue-50 px-2 py-0.5 text-sm font-semibold text-blue-700 sm:inline">Shop</span>
          </Link>

          <DeliverToChip className="hidden sm:flex" />

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <UserHeaderActions />
          </div>
        </div>

        <DeliverToChip className="sm:hidden" />
        <SearchBar />
      </div>

      <div className="border-t border-blue-100 bg-blue-50/60">
        <CategoryNavBar categories={categories} />
      </div>
    </header>
  );
}
