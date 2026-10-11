"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import Select from "@/components/ui/Select";

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

const VEHICLE_ICON: Record<string, string> = { motorbike: "🏍️", bicycle: "🚲", car: "🚗" };

const COLS = "lg:grid-cols-[minmax(0,2.2fr)_8rem_minmax(0,1.3fr)_7.5rem_7rem_7rem_8rem]";

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function RidersList({ riders }: { riders: RiderRow[] }) {
  const { t } = useLocale();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = riders.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!needle || [r.fullName, r.phone, r.licenseNumber, r.vehicleType].some((f) => f?.toLowerCase().includes(needle)))
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, licence or vehicle…"
            className="h-10 w-full rounded-full border border-neutral-300 bg-white pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="all">{t("riders_list.all_statuses")}</option>
          <option value="pending">{t("merchants_list.status_pending")}</option>
          <option value="approved">{t("merchants_list.status_approved")}</option>
          <option value="rejected">{t("merchants_list.status_rejected")}</option>
          <option value="suspended">{t("merchants_list.status_suspended")}</option>
        </Select>
        <span className="ms-auto text-xs font-medium text-neutral-500">
          {filtered.length} {filtered.length === 1 ? "rider" : "riders"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <span className="text-4xl">🛵</span>
          <p className="font-semibold text-neutral-700">{riders.length === 0 ? t("riders_list.no_riders_yet") : t("riders_list.no_riders_match")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className={`hidden items-center gap-4 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 lg:grid ${COLS}`}>
            <span>Rider</span>
            <span>Vehicle</span>
            <span>Contact</span>
            <span>Status</span>
            <span>Availability</span>
            <span>Joined</span>
            <span className="text-end">Action</span>
          </div>
          <ul className="divide-y divide-neutral-100">
            {filtered.map((r) => (
              <li key={r.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-neutral-50/70 lg:gap-x-4 ${COLS}`}>
                <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-extrabold text-emerald-800">{initials(r.fullName ?? "?")}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-neutral-900">{r.fullName ?? "—"}</span>
                    <span className="block truncate text-xs text-neutral-500">{r.licenseNumber ? t("riders_list.license_label", { number: r.licenseNumber }) : "No licence number"}</span>
                  </span>
                </div>

                <div className="row-start-1 flex justify-end lg:order-last lg:row-auto">
                  <Link href={`/admin/riders/${r.id}`} className="inline-flex h-9 items-center rounded-full border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    {r.status === "pending" ? "Review" : t("riders_list.view_details")}
                  </Link>
                </div>

                <span className="col-span-3 text-sm capitalize text-neutral-700 lg:col-span-1">
                  {r.vehicleType ? `${VEHICLE_ICON[r.vehicleType] ?? "🛵"} ${r.vehicleType}` : "—"}
                </span>
                <span className="col-span-3 truncate font-mono text-xs text-neutral-500 lg:col-span-1">{r.phone ?? "—"}</span>
                <span className="col-span-3 lg:col-span-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-600"}`}>{t(STATUS_KEY[r.status] ?? "merchants_list.status_pending")}</span>
                </span>
                <span className="col-span-3 lg:col-span-1">
                  {r.status === "approved" ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${r.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.isAvailable ? "bg-emerald-500" : "bg-neutral-400"}`} />
                      {r.isAvailable ? t("riders_list.online") : t("riders_list.offline")}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </span>
                <span className="col-span-3 text-xs text-neutral-500 lg:col-span-1">
                  <span className="lg:hidden">Joined </span>
                  {day(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
