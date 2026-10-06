import type { UserRole } from "@/types/database";

/** Roles that have a portal to land on. Customers only have the shop. */
export function dashboardPathForRole(role: UserRole | string | null | undefined): string | null {
  switch (role) {
    case "super_admin":
      return "/platform";
    case "admin":
      return "/admin";
    case "rider":
      return "/rider";
    case "merchant":
      return "/merchant";
    case "store_staff":
      return "/warehouse";
    default:
      return null;
  }
}

/** Session cookie set by "Back to shop": while present, "/" shows the shop even
 * if the user's saved landing page is their portal. Cleared on sign-out. */
export const SHOP_MODE_COOKIE = "fs_shop";
