import Link from "next/link";
import type { Category } from "@/types/database";
import { getCategoryTheme } from "@/lib/categoryTheme";

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-9">
      {categories.map((category) => {
        const theme = getCategoryTheme(category.slug);
        return (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group flex flex-col items-center gap-2"
          >
            <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-20 sm:w-20">
              {category.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-3xl sm:text-4xl ${theme.gradient}`}
                >
                  <span className="drop-shadow-sm">{theme.emoji}</span>
                </div>
              )}
            </div>
            <span className="text-center text-xs font-medium text-neutral-700 sm:text-sm">
              {category.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
