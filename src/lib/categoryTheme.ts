export interface CategoryTheme {
  emoji: string;
  image: string; // real photo, used for category tiles (homepage/category grid)
  gradient: string; // tile background gradient
  tint: string; // light background tint (badges, fallback tiles)
  text: string; // accent text color
}

const THEMES: Record<string, CategoryTheme> = {
  fresh: {
    emoji: "🥬",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Liat_Portal_for_Foodie_Disorder_-_Fresh_spinach_leaves.jpg/250px-Liat_Portal_for_Foodie_Disorder_-_Fresh_spinach_leaves.jpg",
    gradient: "from-emerald-400 to-emerald-600",
    tint: "bg-emerald-50",
    text: "text-emerald-700",
  },
  fruits: {
    emoji: "🍊",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/A_vibrant_assortment_of_fresh_fruits.jpg/250px-A_vibrant_assortment_of_fresh_fruits.jpg",
    gradient: "from-orange-400 to-orange-600",
    tint: "bg-orange-50",
    text: "text-orange-700",
  },
  vegetables: {
    emoji: "🥕",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/A_woven_basket_filled_with_an_assortment_of_colorful_vegetables.jpg/250px-A_woven_basket_filled_with_an_assortment_of_colorful_vegetables.jpg",
    gradient: "from-lime-400 to-lime-600",
    tint: "bg-lime-50",
    text: "text-lime-700",
  },
  grocery: {
    emoji: "🛍️",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Faced_products_on_a_supermarket_shelf.JPG/250px-Faced_products_on_a_supermarket_shelf.JPG",
    gradient: "from-amber-400 to-amber-600",
    tint: "bg-amber-50",
    text: "text-amber-700",
  },
  dairy: {
    emoji: "🥛",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/%D0%A0%D1%96%D0%B7%D0%BD%D1%96_%D0%B2%D0%B8%D0%B4%D0%B8_%D0%BC%D0%BE%D0%BB%D0%BE%D1%87%D0%BD%D0%B8%D1%85_%D0%BF%D1%80%D0%BE%D0%B4%D1%83%D0%BA%D1%82%D1%96%D0%B2_%D1%83%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%BE%D0%B3%D0%BE_%D0%B2%D0%B8%D1%80%D0%BE%D0%B1%D0%BD%D0%B8%D1%86%D1%82%D0%B2%D0%B0.jpg/250px-thumbnail.jpg",
    gradient: "from-sky-400 to-sky-600",
    tint: "bg-sky-50",
    text: "text-sky-700",
  },
  meat: {
    emoji: "🥩",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Fresh_Meat_Cuts_at_Market.jpg/250px-Fresh_Meat_Cuts_at_Market.jpg",
    gradient: "from-rose-400 to-rose-600",
    tint: "bg-rose-50",
    text: "text-rose-700",
  },
  bakery: {
    emoji: "🍞",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/MALTESE_BREAD_%282977855466%29.jpg/250px-MALTESE_BREAD_%282977855466%29.jpg",
    gradient: "from-amber-500 to-yellow-700",
    tint: "bg-yellow-50",
    text: "text-yellow-800",
  },
  beverages: {
    emoji: "🥤",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Soft_drink_shelf.JPG/250px-Soft_drink_shelf.JPG",
    gradient: "from-cyan-400 to-cyan-600",
    tint: "bg-cyan-50",
    text: "text-cyan-700",
  },
  household: {
    emoji: "🧴",
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Pirna_DDR_Museum_Waschmittel_Reiniger_Sprays.jpg/250px-Pirna_DDR_Museum_Waschmittel_Reiniger_Sprays.jpg",
    gradient: "from-violet-400 to-violet-600",
    tint: "bg-violet-50",
    text: "text-violet-700",
  },
};

const DEFAULT_THEME: CategoryTheme = {
  emoji: "🛒",
  image: "",
  gradient: "from-neutral-400 to-neutral-600",
  tint: "bg-neutral-100",
  text: "text-neutral-700",
};

export function getCategoryTheme(slug: string | null | undefined): CategoryTheme {
  if (!slug) return DEFAULT_THEME;
  return THEMES[slug] ?? DEFAULT_THEME;
}
