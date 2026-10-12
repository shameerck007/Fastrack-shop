/** Item returns: the reasons, statuses and shapes shared by the shop, admin and rider screens. Safe for browser and server. */

export const RETURN_REASONS: { id: string; label: string; hint?: string; defect?: boolean }[] = [
  { id: "damaged", label: "Damaged or defective", hint: "A photo is needed", defect: true },
  { id: "wrong_item", label: "Wrong item received", defect: true },
  { id: "missing_part", label: "Missing parts or items", hint: "A photo is needed", defect: true },
  { id: "not_as_described", label: "Not as described" },
  { id: "quality", label: "Quality is not what I expected" },
  { id: "changed_mind", label: "I changed my mind" },
  { id: "other", label: "Another reason" },
];
export const reasonLabel = (id: string) => RETURN_REASONS.find((r) => r.id === id)?.label ?? id;

export type ReturnStatus = "requested" | "approved" | "pickup_assigned" | "picked_up" | "refunded" | "rejected" | "cancelled";

export const RETURN_STATUS: Record<ReturnStatus, { label: string; customer: string; tone: string }> = {
  requested: { label: "Needs review", customer: "Waiting for approval", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  approved: { label: "Approved", customer: "Approved. A rider will collect it", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  pickup_assigned: { label: "Rider assigned", customer: "A rider is coming to collect it", tone: "bg-blue-50 text-blue-800 ring-blue-200" },
  picked_up: { label: "Collected", customer: "Collected", tone: "bg-blue-50 text-blue-800 ring-blue-200" },
  refunded: { label: "Refunded", customer: "Refunded", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Rejected", customer: "Not accepted", tone: "bg-rose-50 text-rose-800 ring-rose-200" },
  cancelled: { label: "Cancelled", customer: "Cancelled", tone: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
};

export interface ReturnRow {
  id: string;
  return_number: string;
  order_id: string;
  order_item_id: string;
  user_id: string;
  quantity: number;
  reason: string;
  details: string | null;
  photos: string[];
  status: ReturnStatus;
  resolution: "pickup" | "keep" | null;
  admin_note: string | null;
  rider_id: string | null;
  pickup_code: string;
  refund_delivery: boolean;
  refund_amount: number | null;
  created_at: string;
  refunded_at: string | null;
}

/** What the order page needs to know about one item to offer a return. */
export interface ReturnEligibility {
  /** Units that can still be returned. */
  left: number;
  /** Days from delivery. 0 = this item cannot be returned. */
  windowDays: number;
  /** When the return period ends. */
  closesAt: string | null;
}
