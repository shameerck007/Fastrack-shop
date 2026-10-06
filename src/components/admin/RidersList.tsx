"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";

export interface RiderRow {
  id: string;
  fullName: string | null;
  phone: string | null;
  vehicleType: string | null;
  licenseNumber: string | null;
  status: string;
  isAvailable: boolean;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

const STATUS_KEY: Record<string, string> = {
  pending: "merchants_list.status_pending",
  approved: "merchants_list.status_approved",
  rejected: "merchants_list.status_rejected",
  suspended: "merchants_list.status_suspended",
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function RidersList({ riders }: { riders: RiderRow[] }) {
  const { t } = useLocale();
  const [status, setStatus] = useState("all");

  const filtered = riders.filter((r) => status === "all" || r.status === status);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-neutral-700">{t("riders_list.riders")}</h2>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700"
        >
          <option value="all">{t("riders_list.all_statuses")}</option>
          <option value="pending">{t("merchants_list.status_pending")}</option>
          <option value="approved">{t("merchants_list.status_approved")}</option>
          <option value="rejected">{t("merchants_list.status_rejected")}</option>
          <option value="suspended">{t("merchants_list.status_suspended")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-neutral-500">
          {riders.length === 0 ? t("riders_list.no_riders_yet") : t("riders_list.no_riders_match")}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/riders/${r.id}`}
                className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {initials(r.fullName ?? "?")}
                </span>
                <div className="min-w-[10rem] flex-1">
                  <p className="truncate font-medium text-neutral-900">{r.fullName ?? "—"}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.licenseNumber ? t("riders_list.license_label", { number: r.licenseNumber }) : "—"}
                    {r.phone && ` · ${r.phone}`}
                  </p>
                </div>
                <span className="min-w-[6rem] text-xs text-neutral-500">{r.vehicleType ?? "—"}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-neutral-100"}`}>
                  {t(STATUS_KEY[r.status] ?? "merchants_list.status_pending")}
                </span>
                {r.status === "approved" && (
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:block ${
                      r.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {r.isAvailable ? t("riders_list.online") : t("riders_list.offline")}
                  </span>
                )}
                <span className="ms-auto shrink-0 text-xs font-medium text-blue-600">{t("riders_list.view_details")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
