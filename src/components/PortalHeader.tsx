import Link from "@/components/Link";
import Wordmark from "@/components/Wordmark";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationBell from "@/components/NotificationBell";
import { signOut } from "@/lib/actions/auth";

/** The slim top bar of the admin, supplier and store portals: logo, what you are working in, and the usual actions, all on one line. */
export default function PortalHeader({
  homeHref,
  title,
  subtitle,
  chip,
  backLabel,
  logoutLabel,
  maxWidth = "max-w-7xl",
}: {
  homeHref: string;
  title: string;
  subtitle?: string;
  /** A small status badge on the right (name of the signed-in admin, "Approved seller"...). */
  chip?: string | null;
  backLabel: string;
  logoutLabel: string;
  maxWidth?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/90 backdrop-blur">
      <div className={`mx-auto flex h-14 items-center gap-3 px-4 ${maxWidth}`}>
        <Link href={homeHref} className="flex min-w-0 items-center gap-3">
          <span className="shrink-0">
            <Wordmark height={22} />
          </span>
          <span aria-hidden className="hidden h-6 w-px shrink-0 bg-neutral-200 sm:block" />
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block truncate text-sm font-bold text-neutral-900">{title}</span>
            {subtitle && <span className="block truncate text-[11px] text-neutral-500">{subtitle}</span>}
          </span>
        </Link>

        <div className="ms-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <Link href="/api/enter-shop" prefetch={false} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
            <span aria-hidden>🛍️</span>
            <span className="hidden md:inline">{backLabel}</span>
          </Link>
          {/* Face / fingerprint sign-in and the app lock (the lock itself works on every page, portals included). */}
          <Link href="/account/security" prefetch={false} aria-label="Login and security" title="Login and security" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          </Link>
          {/* On a phone the language switch lives on the Account page, so the bar stays on one line. */}
          <LanguageToggle className="max-sm:hidden" />
          <NotificationBell />
          {chip && <span className="hidden max-w-[11rem] truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 lg:inline">● {chip}</span>}
          <form action={signOut}>
            <button aria-label={logoutLabel} className="flex h-10 items-center justify-center rounded-full px-3 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 max-sm:w-10 max-sm:px-0">
              <span className="max-sm:hidden">{logoutLabel}</span>
              <span aria-hidden className="text-lg sm:hidden">🚪</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
