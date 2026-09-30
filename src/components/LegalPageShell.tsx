import Link from "next/link";

export function LegalPageShell({
  title,
  effectiveDate,
  intro,
  toc,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro: string;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <div className="border-b border-blue-100 bg-blue-50/60">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">Effective {effectiveDate}</p>
          <p className="mt-3 max-w-2xl text-sm text-neutral-600">{intro}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav className="hidden md:block">
          <div className="sticky top-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">On this page</p>
            <ul className="space-y-1 border-s border-neutral-200 text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block border-s-2 border-transparent py-1 ps-3 text-neutral-600 hover:border-blue-600 hover:text-blue-700"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-1 text-sm">
              <Link href="/terms" className="block text-blue-600 hover:underline">
                Conditions of Use
              </Link>
              <Link href="/privacy" className="block text-blue-600 hover:underline">
                Privacy Notice
              </Link>
            </div>
          </div>
        </nav>

        <article className="min-w-0 space-y-8 text-sm leading-relaxed text-neutral-700">{children}</article>
      </div>
    </div>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
