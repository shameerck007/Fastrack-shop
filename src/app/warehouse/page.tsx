import { redirect } from "next/navigation";

export default function WarehouseRootPage() {
  redirect("/warehouse/orders");
}
