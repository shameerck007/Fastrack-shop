"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";

export interface MerchantRow {
  id: string;
  name: string;
  crNumber: string;
  contactPhone: string | null;
  city: string;
  country: string;
  status: string;
  productCount: number;
  createdAt: string;
  logoUrl: string | null;
  /** Pre-rendered open/closed text for approved shops, null otherwise. */
  openText: string | null;
  isOpen: boolean | null;
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

export default function MerchantsList({ merchants }: { merchants: MerchantRow[] }) {
  const { t } = useLocale();
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const countries = useMemo(() => Array.from(new Set(merchants.map((m) => m.country))).sort(), [merchants]);

  const needle = q.trim().toLowerCase();
  const filtered = merchants.filter(
    (m) =>
      (country === "all" || m.country === country) &&
      (status === "all" || m.status === status) &&
      (!needle || [m.name, m.crNumber, m.contactPhone, m.city, m.country].some((f) => f?.toLowerCase().includes(needle)))
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-neutral-700">
          {t("merchants_list.merchants")} <span className="font-normal text-neutral-400">({filtered.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search by name, phone, number…"
          className="w-full rounded-full border border-neutral-300 px-4 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
        />

          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700"
          >
            <option value="all">{t("merchants_list.all_countries")}</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700"
          >
            <option value="all">{t("merchants_list.all_statuses")}</option>
            <option value="pending">{t("merchants_list.status_pending")}</option>
            <option value="approved">{t("merchants_list.status_approved")}</option>
            <option value="rejected">{t("merchants_list.status_rejected")}</option>
            <option value="suspended">{t("merchants_list.status_suspended")}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-neutral-500">
          {merchants.length === 0 ? t("merchants_list.no_merchants_yet") : t("merchants_list.no_merchants_match")}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/merchants/${m.id}`}
                className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-xs font-bold text-white">
                  {m.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.logoUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    initials(m.name)
                  )}
                </span>
                <div className="min-w-[10rem] flex-1">
                  <p className="truncate font-medium text-neutral-900">{m.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t("merchants_list.cr_label", { number: m.crNumber })}
                    {m.contactPhone && ` · ${m.contactPhone}`}
                  </p>
                </div>
                <span className="min-w-[8rem] text-xs text-neutral-500">
                  {m.city}, {m.country}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status] ?? "bg-neutral-100"}`}>
                  {t(STATUS_KEY[m.status] ?? "merchants_list.status_pending")}
                </span>
                {m.openText && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {m.openText}
                  </span>
                )}
                <span className="hidden shrink-0 text-xs text-neutral-500 sm:block">
                  {t("merchants_list.products_count", { count: m.productCount })}
                </span>
                <span className="ms-auto shrink-0 text-xs font-medium text-blue-600">{t("merchants_list.view_details")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
