// The account types in the platform and where each one is managed. Kept apart from the server-only queries so the browser can use it too.

export interface RoleInfo {
  value: string;
  label: string;
  single: string;
  icon: string;
  tone: string;
}

export const ROLES: RoleInfo[] = [
  { value: "customer", label: "Customers", single: "Customer", icon: "🛍️", tone: "bg-blue-50 text-blue-800" },
  { value: "merchant", label: "Suppliers", single: "Supplier", icon: "🏪", tone: "bg-amber-50 text-amber-800" },
  { value: "rider", label: "Riders", single: "Rider", icon: "🛵", tone: "bg-emerald-50 text-emerald-800" },
  { value: "store_staff", label: "Store staff", single: "Store staff", icon: "📦", tone: "bg-violet-50 text-violet-800" },
  { value: "admin", label: "Admins", single: "Admin", icon: "🛡️", tone: "bg-neutral-100 text-neutral-700" },
  { value: "super_admin", label: "Super admins", single: "Super admin", icon: "👑", tone: "bg-neutral-900 text-white" },
];

export const roleInfo = (role: string): RoleInfo => ROLES.find((r) => r.value === role) ?? { value: role, label: role, single: role, icon: "👤", tone: "bg-neutral-100 text-neutral-600" };
