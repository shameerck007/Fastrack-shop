/** The title block at the top of onboarding pages: plain and calm (icon, title, one line of help, small chips), no coloured banner. */
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
    <header className="mb-5 flex items-start gap-3.5 border-b border-neutral-200 pb-5">
      {icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-2xl shadow-sm" aria-hidden>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-snug text-neutral-600">{subtitle}</p>}
        {chips && chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                {c}
              </span>
            ))}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
  );
}
