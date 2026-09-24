import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { getMyStore } from "@/lib/merchant";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/merchant", label: "Dashboard" },
  { href: "/merchant/products", label: "Products" },
];

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireRole("merchant");
  const store = await getMyStore();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/merchant" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-neutral-900">{store?.name ?? "FasTrack Merchant"}</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <form action={signOut}>
              <button className="text-neutral-500 hover:text-neutral-900">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="w-48 shrink-0">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
