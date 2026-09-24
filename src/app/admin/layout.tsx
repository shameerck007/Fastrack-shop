import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import Logo from "@/components/Logo";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size={28} />
            <div>
              <span className="block font-semibold leading-tight text-neutral-900">FasTrack Admin</span>
              <span className="block text-xs leading-tight text-neutral-400">Control Center</span>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline">
              ● {profile.full_name ?? "Admin"}
            </span>
            <Link href="/" className="text-neutral-500 hover:text-neutral-900">
              ← Back to shop
            </Link>
            <form action={signOut}>
              <button className="text-neutral-500 hover:text-neutral-900">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="w-48 shrink-0">
          <AdminNav />
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
