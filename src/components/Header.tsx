import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SearchBar from "@/components/SearchBar";
import Logo from "@/components/Logo";
import { getCartItemCount } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [cartCount, categories] = await Promise.all([getCartItemCount(), getCategories()]);

  let firstName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    firstName = profile?.full_name?.split(" ")[0] ?? null;
  }

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

          <div className="flex items-center gap-4 text-sm">
            <Link href="/orders" className="leading-tight hover:text-blue-600">
              <span className="block text-[11px] text-neutral-500">Returns</span>
              <span className="font-medium">& Orders</span>
            </Link>
            <Link href="/cart" className="relative flex items-center gap-1 hover:text-blue-600">
              🛒 Cart
              {cartCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <Link href="/account" className="leading-tight hover:text-blue-600">
                <span className="block text-[11px] text-neutral-500">Hello, {firstName ?? "there"}</span>
                <span className="font-medium">Account</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800"
              >
                Login
              </Link>
            )}
          </div>
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
          {user && (
            <Link href="/orders" className="shrink-0 whitespace-nowrap hover:text-blue-700">
              Buy Again
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
