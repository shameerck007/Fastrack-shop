export default function HomeHero({
  eyebrow,
  title,
  subtitle,
  chips,
  cta,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  chips: string[];
  cta: string;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 px-5 py-6 text-white shadow-lg shadow-blue-900/20 sm:px-8 sm:py-9">
      <span aria-hidden className="absolute -end-10 -top-12 h-44 w-44 rounded-full bg-amber-300/90" />
      <span aria-hidden className="absolute -bottom-16 end-16 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden className="absolute end-6 top-8 text-6xl drop-shadow-md sm:end-14 sm:text-7xl">
        🛵
      </span>

      <div className="relative max-w-[70%] sm:max-w-md">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-200">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-blue-100 sm:text-base">{subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              {chip}
            </span>
          ))}
        </div>

        <a
          href="#offers"
          className="mt-5 inline-block rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-neutral-900 shadow-md transition hover:bg-amber-300 active:scale-95"
        >
          {cta}
        </a>
      </div>
    </section>
  );
}
