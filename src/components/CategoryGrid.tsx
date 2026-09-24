import Link from "next/link";
import type { Category } from "@/types/database";

const ICONS: Record<string, string> = {
  leaf: "🥬",
  apple: "🍎",
  carrot: "🥕",
  "shopping-basket": "🛍️",
  milk: "🥛",
  beef: "🥩",
  bread: "🍞",
  "cup-soda": "🥤",
  "spray-can": "🧴",
};

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-9">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categories/${category.slug}`}
          className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-center transition hover:border-emerald-400 hover:shadow-sm"
        >
          <span className="text-2xl">{ICONS[category.icon ?? ""] ?? "🛒"}</span>
          <span className="text-xs font-medium text-neutral-700">{category.name}</span>
        </Link>
      ))}
    </div>
  );
}
