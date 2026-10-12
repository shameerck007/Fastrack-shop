/** What the codes in the delivery flow contain. Safe for browser and server. */

/** Orders are compared without a leading "#", spaces or case. */
export const normaliseCode = (s: string) => s.trim().replace(/^#/, "").replace(/\s+/g, "").toUpperCase();

/** The customer's handover QR: the order number and the 4-digit OTP, so scanning it is the same as typing the OTP. */
export const deliveryQrPayload = (orderNumber: string, otp: string) => `FTD:${orderNumber}:${otp}`;

export function parseDeliveryQr(code: string): { orderNumber: string; otp: string } | null {
  const m = /^FTD:([^:]+):(\d{4})$/i.exec(code.trim());
  return m ? { orderNumber: m[1], otp: m[2] } : null;
}

export const sameOrder = (a: string, b: string) => normaliseCode(a) === normaliseCode(b);

/** One line of an order to pack, with every code that identifies it. */
export interface PackItem {
  id: string;
  name: string;
  quantity: number;
  codes: string[];
}
