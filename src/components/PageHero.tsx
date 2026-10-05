/** Blue gradient banner used at the top of portal home pages and onboarding pages. */
export default function PageHero({
  icon,
  title,
  subtitle,
  chips,
  children,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-5 text-white shadow-lg shadow-blue-600/20 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-14 right-16 h-32 w-32 rounded-full bg-white/10" />
      <div className="relative flex items-start gap-4">
        {icon && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-blue-50/90">{subtitle}</p>}
          {chips && chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span key={c} className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  {c}
                </span>
              ))}
            </div>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}
