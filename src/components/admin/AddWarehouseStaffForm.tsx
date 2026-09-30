"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import {
  findUserByEmailForWarehouse,
  adminAssignWarehouseStaff,
  type FoundUser,
} from "@/lib/actions/admin-warehouse-staff";
import { useLocale } from "@/components/LocaleProvider";

export default function AddWarehouseStaffForm({ warehouseId }: { warehouseId: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function reset() {
    setEmail("");
    setFound(undefined);
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function search() {
    setError(null);
    startSearch(async () => {
      try {
        const user = await findUserByEmailForWarehouse(email);
        setFound(user);
        if (!user) setError(t("warehouse_staff.no_account"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("warehouse_staff.lookup_failed"));
      }
    });
  }

  function submit() {
    if (!found) return;
    setError(null);
    startSave(async () => {
      try {
        await adminAssignWarehouseStaff(warehouseId, found.id);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("warehouse_staff.could_not_assign"));
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
      >
        {t("warehouse_staff.add_staff_btn")}
      </button>

      <Modal open={open} onClose={close} title={t("warehouse_staff.add_staff_title")} size="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">{t("warehouse_staff.intro")}</p>

          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(undefined);
                setError(null);
              }}
              placeholder={t("warehouse_staff.email_placeholder")}
              type="email"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              onClick={search}
              disabled={!email.trim() || searching}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {searching ? t("add_rider.searching") : t("add_rider.find")}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {found && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {t("add_rider.found_account", { name: found.fullName ?? t("add_rider.unnamed_account"), role: found.role })}
              </p>
              <button
                onClick={submit}
                disabled={saving}
                className="mt-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? t("warehouse_staff.assigning") : t("warehouse_staff.assign_staff")}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
