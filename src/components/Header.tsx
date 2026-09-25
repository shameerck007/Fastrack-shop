import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import Logo from "@/components/Logo";
import UserHeaderActions from "@/components/UserHeaderActions";
import { getCategories } from "@/lib/catalog";

export default async function Header() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-xl font-bold text-neutral-900">
              FasTrack <span className="text-blue-600">Shop</span>
            </span>
          </Link>

          <Link
            href="/addresses"
            className="hidden items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 sm:flex"
          >
            📍 Deliver to <span className="font-medium text-neutral-900">Home</span>
          </Link>

          <UserHeaderActions />
        </div>

        <SearchBar />
      </div>

      <div className="border-t border-blue-100 bg-blue-50/60">
        <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm text-blue-950">
          <Link href="/" className="shrink-0 font-medium hover:text-blue-700">
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="shrink-0 whitespace-nowrap hover:text-blue-700"
            >
              {category.name}
            </Link>
          ))}
          <Link href="/orders" className="shrink-0 whitespace-nowrap hover:text-blue-700">
            Buy Again
          </Link>
        </div>
      </div>
    </header>
  );
}
