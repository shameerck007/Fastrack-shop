"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminRemoveWarehouseStaff } from "@/lib/actions/admin-warehouse-staff";
import { useLocale } from "@/components/LocaleProvider";

export default function RemoveWarehouseStaffButton({
  staffId,
  userId,
  warehouseId,
}: {
  staffId: string;
  userId: string;
  warehouseId: string;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await adminRemoveWarehouseStaff(staffId, userId, warehouseId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {t("warehouse_staff.remove")}
    </button>
  );
}
