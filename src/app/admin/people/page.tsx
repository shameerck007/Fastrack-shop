import { redirect } from "next/navigation";

// Users and roles live on the Users page.
export default function AdminPeopleRedirect() {
  redirect("/admin/users");
}
