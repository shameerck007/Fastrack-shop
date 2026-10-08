"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { adminCreateFastrackWarehouse } from "@/lib/actions/admin-fastrack-store";
import { useLocale } from "@/components/LocaleProvider";

export default function AddFastrackStoreForm() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const router = useRouter();

  function close() {
    setOpen(false);
    setName("");
    setAddressLine("");
    setError(null);
  }

  function submit() {
    if (!name.trim()) {
      setError(t("fastrack_stores.name_required"));
      return;
    }
    setError(null);
    startSave(async () => {
      try {
        const id = await adminCreateFastrackWarehouse({ name: name.trim(), addressLine: addressLine.trim() });
        close();
        router.push(`/admin/store/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("fastrack_stores.could_not_create"));
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
      >
        {t("fastrack_stores.add_store_btn")}
      </button>

      <Modal open={open} onClose={close} title={t("fastrack_stores.add_store_title")} size="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">{t("fastrack_stores.add_store_intro")}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fastrack_stores.store_name_placeholder")}
            className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder={t("fastrack_stores.address_placeholder")}
            className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="text-xs text-neutral-400">{t("fastrack_stores.pin_location_hint")}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="mt-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? t("fastrack_stores.creating") : t("fastrack_stores.create_store")}
          </button>
        </div>
      </Modal>
    </>
  );
}
