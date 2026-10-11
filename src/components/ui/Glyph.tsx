/** An icon that is either an emoji or one of our own drawn icons, picked by name. Drawn icons take the text colour of where they sit. */
export default function Glyph({ icon, className = "h-[1.1em] w-[1.1em]" }: { icon: string; className?: string }) {
  if (icon === "gps") {
    // The GPS "locate me" crosshair: a ring, a dot in the middle and four ticks.
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
        <circle cx="12" cy="12" r="6.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22" />
      </svg>
    );
  }
  return <>{icon}</>;
}
