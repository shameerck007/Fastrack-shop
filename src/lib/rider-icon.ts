/**
 * The FasTrack delivery rider as a small picture, always facing right (the direction of travel along a progress bar, from the shop to
 * the customer). It replaces the scooter emoji, which faces left on most phones and so looked like it was riding backwards. Where the
 * rider moves the other way (the live map), flip it with a CSS scaleX(-1).
 */
export function riderIconSvg(heightPx: number): string {
  const h = Math.round(heightPx);
  const w = Math.round((h * 130) / 84);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 84" width="${w}" height="${h}" aria-hidden="true" style="display:block;overflow:visible">` +
    `<rect x="0" y="14" width="46" height="36" rx="6" fill="#005fb0"/><rect x="0" y="14" width="46" height="8" rx="5" fill="#0070d0"/>` +
    `<path d="M23 28 l8 12 h-4.8 l-3.2 -4.6 l-3.2 4.6 h-4.8 z" fill="#fff"/>` +
    `<path d="M20 56 Q20 44 36 44 L58 44 L58 58 Z" fill="#0070d0"/><path d="M44 58 H88 L84 50 H52 Z" fill="#005fb0"/>` +
    `<path d="M84 58 L90 26 Q92 22 96 24 L99 26 L94 58 Z" fill="#0070d0"/><rect x="35" y="39" width="26" height="6" rx="3" fill="#002050"/>` +
    `<path d="M90 26 L88 20 H100" stroke="#002050" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M97 31 h6 a3 3 0 0 1 0 6 h-6 z" fill="#ffd54a"/>` +
    `<path d="M52 41 L66 47 L68 58" stroke="#002050" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M50 40 Q56 24 66 20" stroke="#00b0f0" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M64 24 L88 24" stroke="#00b0f0" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="90" cy="24" r="2.8" fill="#f2c9a0"/><circle cx="70" cy="13" r="7" fill="#f2c9a0"/>` +
    `<path d="M62.6 13 a7.4 7.4 0 0 1 14.8 0 z" fill="#002050"/><path d="M72 11 h6 v4 h-5 z" fill="#8fd3f4"/>` +
    `<circle cx="30" cy="68" r="11" fill="#001535"/><circle cx="30" cy="68" r="5" fill="#cfe3f8"/>` +
    `<circle cx="92" cy="68" r="11" fill="#001535"/><circle cx="92" cy="68" r="5" fill="#cfe3f8"/>` +
    `</svg>`
  );
}
