// Stand-in artwork for shops that haven't uploaded a logo or cover yet: stable per shop
// (derived from its name) and kept inside FasTrack's cool blue family.

const PALETTES: { from: string; to: string; ring: string }[] = [
  { from: "#2563eb", to: "#1e3a8a", ring: "#93c5fd" },
  { from: "#0ea5e9", to: "#1d4ed8", ring: "#bae6fd" },
  { from: "#4f46e5", to: "#1e40af", ring: "#c7d2fe" },
  { from: "#0891b2", to: "#1e3a8a", ring: "#a5f3fc" },
  { from: "#3b82f6", to: "#312e81", ring: "#bfdbfe" },
  { from: "#0d9488", to: "#1d4ed8", ring: "#99f6e4" },
];

const EMOJIS = ["🛒", "🥬", "🍞", "🥛", "🍎", "🧃", "🥫", "🍫"];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function placeholderFor(name: string) {
  const h = hash(name.trim().toLowerCase());
  const palette = PALETTES[h % PALETTES.length];
  return {
    ...palette,
    gradient: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
    emoji: EMOJIS[h % EMOJIS.length],
    initial: name.trim().charAt(0).toUpperCase() || "?",
  };
}
