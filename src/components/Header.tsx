import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SearchBar from "@/components/SearchBar";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-emerald-600">
            FasTrack <span className="text-neutral-900">Shop</span>
          </Link>

          <Link
            href="/addresses"
            className="hidden items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 sm:flex"
          >
            📍 Deliver to <span className="font-medium text-neutral-900">Home</span>
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/orders" className="hover:text-emerald-600">
              Orders
            </Link>
            <Link href="/cart" className="hover:text-emerald-600">
              🛒 Cart
            </Link>
            {user ? (
              <Link href="/account" className="hover:text-emerald-600">
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-white hover:bg-emerald-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        <SearchBar />
      </div>
    </header>
  );
}
