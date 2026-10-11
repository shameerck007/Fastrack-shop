import { redirect } from "next/navigation";

// Riders are managed on the Users page.
export default function AdminRidersRedirect() {
  redirect("/admin/users?role=rider");
}
