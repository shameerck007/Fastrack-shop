import { redirect } from "next/navigation";

// Customers are managed on the Users page.
export default function AdminCustomersRedirect() {
  redirect("/admin/users?role=customer");
}
