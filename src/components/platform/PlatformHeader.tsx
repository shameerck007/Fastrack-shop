/** Compact page header for the platform area: icon, title, one-line explanation, actions on the right. */
export default function PlatformHeader({
  icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-2xl shadow-md shadow-blue-600/25">{icon}</span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-neutral-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4 border-t border-neutral-100 pt-4">{children}</div>}
    </header>
  );
}
