import Link from "next/link";
import CartItemRow from "@/components/CartItemRow";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { formatSAR } from "@/lib/utils";

export default async function CartPage() {
  const items = await getCartItems();
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <Link href="/" className="mt-3 inline-block text-emerald-600 hover:underline">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Your Cart</h1>

      <div className="rounded-xl border border-neutral-200 bg-white px-4">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-4 space-y-1 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Subtotal</span>
          <span>{formatSAR(subtotal)}</span>
        </div>
        <p className="text-xs text-neutral-400">
          Delivery fee, VAT and discounts are calculated at checkout.
        </p>
      </div>

      <Link
        href="/checkout"
        className="mt-4 block rounded-full bg-emerald-600 py-3 text-center font-medium text-white hover:bg-emerald-700"
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}
