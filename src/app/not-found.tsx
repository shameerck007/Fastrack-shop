import Link from "@/components/Link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl shadow-inner ring-8 ring-brand-50/60">🧭</span>
      <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">We can&apos;t find that page</h1>
      <p className="mt-2 text-sm text-neutral-600">The link may be old, or the product or order may have been removed. Check the address, or start again from the shop.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-brand-700 px-6 text-sm font-bold text-white transition hover:bg-brand-800">
          Go to the shop
        </Link>
        <Link href="/orders" className="inline-flex h-11 items-center rounded-full border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          My orders
        </Link>
      </div>
    </div>
  );
}
