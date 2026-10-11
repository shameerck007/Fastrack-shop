import { redirect } from "next/navigation";

// Customers are managed on the Users page.
export default async function AdminCustomerRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/users?role=customer&selected=${id}`);
}
