export interface CategoryTheme {
  emoji: string;
  gradient: string; // tile background gradient (used when a category has no photo yet)
  tint: string; // light background tint (badges, fallback tiles)
  text: string; // accent text color
}

const THEMES: Record<string, CategoryTheme> = {
  fresh: { emoji: "🥬", gradient: "from-emerald-400 to-emerald-600", tint: "bg-emerald-50", text: "text-emerald-700" },
  fruits: { emoji: "🍊", gradient: "from-orange-400 to-orange-600", tint: "bg-orange-50", text: "text-orange-700" },
  vegetables: { emoji: "🥕", gradient: "from-lime-400 to-lime-600", tint: "bg-lime-50", text: "text-lime-700" },
  grocery: { emoji: "🛍️", gradient: "from-amber-400 to-amber-600", tint: "bg-amber-50", text: "text-amber-700" },
  dairy: { emoji: "🥛", gradient: "from-sky-400 to-sky-600", tint: "bg-sky-50", text: "text-sky-700" },
  meat: { emoji: "🥩", gradient: "from-rose-400 to-rose-600", tint: "bg-rose-50", text: "text-rose-700" },
  bakery: { emoji: "🍞", gradient: "from-amber-500 to-yellow-700", tint: "bg-yellow-50", text: "text-yellow-800" },
  beverages: { emoji: "🥤", gradient: "from-cyan-400 to-cyan-600", tint: "bg-cyan-50", text: "text-cyan-700" },
  household: { emoji: "🧴", gradient: "from-violet-400 to-violet-600", tint: "bg-violet-50", text: "text-violet-700" },
};

const DEFAULT_THEME: CategoryTheme = {
  emoji: "🛒",
  gradient: "from-neutral-400 to-neutral-600",
  tint: "bg-neutral-100",
  text: "text-neutral-700",
};

export function getCategoryTheme(slug: string | null | undefined): CategoryTheme {
  if (!slug) return DEFAULT_THEME;
  return THEMES[slug] ?? DEFAULT_THEME;
}
