import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold">Account</h1>
      <div className="mb-6 space-y-1 text-sm">
        <p>
          <span className="text-neutral-500">Name:</span> {profile?.full_name ?? "—"}
        </p>
        <p>
          <span className="text-neutral-500">Email:</span> {user.email}
        </p>
        <p>
          <span className="text-neutral-500">Phone:</span> {profile?.phone ?? "—"}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/orders" className="text-blue-600 hover:underline">
          Order history
        </Link>
        <Link href="/addresses" className="text-blue-600 hover:underline">
          Manage addresses
        </Link>
        {(profile?.role === "admin" || profile?.role === "rider") && (
          <Link href={profile.role === "admin" ? "/admin" : "/rider"} className="text-blue-600 hover:underline">
            Go to {profile.role} dashboard
          </Link>
        )}
      </div>

      <form action={signOut} className="mt-6">
        <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">
          Log out
        </button>
      </form>
    </div>
  );
}
