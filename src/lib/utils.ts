export function formatSAR(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export const VAT_RATE = 0.15;

/** Product/cart prices are VAT-inclusive (the displayed price is what the
 * customer pays for the item) — this extracts the VAT portion already
 * inside an inclusive amount, for the receipt/invoice breakdown. It does
 * not add VAT on top; see placeOrder / CheckoutForm for where it's used. */
export function extractVat(amountInclVat: number, rate = VAT_RATE): number {
  return Math.round(((amountInclVat * rate) / (1 + rate)) * 100) / 100;
}

export function generateOrderNumber(): string {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `FT${random}`;
}

export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function calculateVariableWeightPrice(pricePerKg: number, packedWeightKg: number): number {
  return Math.round(pricePerKg * packedWeightKg * 100) / 100;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  preparing: "Store preparing",
  ready_for_pickup: "Ready for pickup",
  rider_assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
] as const;
