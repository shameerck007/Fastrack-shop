"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/addresses";
import AddressForm from "@/components/AddressForm";
import type { Address } from "@/types/database";

export default function AddressCard({ address }: { address: Address }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (editing) {
    return <AddressForm existing={address} onDone={() => setEditing(false)} />;
  }

  const nationalParts = [
    address.district,
    address.building_number && `Bldg ${address.building_number}`,
    address.additional_number && `Add'l ${address.additional_number}`,
    address.unit_number && `Unit ${address.unit_number}`,
    address.postal_code,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize">
              {address.label}
            </span>
            {address.is_default && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Default</span>
            )}
          </div>
          <p className="mt-1 text-sm">{address.address_line}</p>
          {nationalParts.length > 0 && (
            <p className="text-xs text-neutral-500">{nationalParts.join(" · ")}</p>
          )}
          <p className="text-xs text-neutral-500">{address.city}</p>
          {address.short_address && (
            <p className="text-xs text-neutral-400">National Address: {address.short_address}</p>
          )}
          {address.lat != null && address.lng != null && (
            <p className="text-xs text-neutral-400">📍 Location pinned</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline">
            Edit
          </button>
          {!address.is_default && (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setDefaultAddress(address.id);
                  router.refresh();
                })
              }
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              Set as default
            </button>
          )}
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!confirm("Delete this address?")) return;
                await deleteAddress(address.id);
                router.refresh();
              })
            }
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
