import { redirect } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getAddresses } from "@/lib/addresses";

export default async function CheckoutPage() {
  const [items, addresses] = await Promise.all([getCartItems(), getAddresses()]);

  if (items.length === 0) redirect("/cart");

  const subtotal = cartSubtotal(items);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Checkout</h1>
      <CheckoutForm addresses={addresses} subtotal={subtotal} />
    </div>
  );
}
