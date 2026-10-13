/**
 * The FasTrack map pin as an icon for text and tiles: the same navy teardrop with a white centre that the maps use (see
 * src/lib/map-pin.ts), replacing the 📍 emoji. It is sized by the text around it (1em), so it fits wherever the emoji was.
 */
export default function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 46" className={`inline-block h-[1.15em] w-[0.85em] shrink-0 align-[-0.2em] ${className}`} aria-hidden="true" focusable="false">
      <path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 11 12.6 26 14.7 27.5.5.4 1.3.4 1.7 0C20 42.8 32.5 27.8 32.5 16.8 32.5 8.3 25.6 1.5 17 1.5z" fill="#002050" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="17" cy="16.8" r="6.6" fill="#fff" />
    </svg>
  );
}
