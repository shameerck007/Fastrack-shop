export default function Hero() {
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 px-6 py-8 text-white sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-6 -top-10 text-[140px] leading-none opacity-20 sm:text-[200px]">
        🥬
      </div>
      <div className="relative max-w-md">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          ⚡ Delivered in 15–60 minutes
        </span>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          Everything you need.
          <br />
          Delivered.
        </h1>
        <p className="mt-2 text-sm text-emerald-50/90">
          Fresh groceries, household essentials and more — straight to your door in Riyadh.
        </p>
      </div>
    </div>
  );
}
