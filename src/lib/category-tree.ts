import type { Category } from "@/types/database";

/** Flattens a mixed list into top-level categories each immediately followed by their subcategories, for dropdown display. */
export function orderedCategories(categories: Category[]): Category[] {
  const topLevel = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const result: Category[] = [];
  for (const top of topLevel) {
    result.push(top);
    const children = categories
      .filter((c) => c.parent_id === top.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    result.push(...children);
  }
  return result;
}
