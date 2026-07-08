"use client";

import { computeCashbookNet, describeBalance, formatPaise } from "@khatabook/shared";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AttachmentThumbs } from "@/components/image-upload";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddCashbookSheet } from "@/components/add-cashbook-sheet";
import { AddPartySheet } from "@/components/add-party-sheet";
import { useAuth } from "@/components/providers";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { defaultRange } from "@/lib/dates";
import { useBusinesses, useCashbook, useParties, useSummary } from "@/lib/queries";
import type { CashEntry, PartyListItem } from "@/lib/types";

function balanceLabel(b: PartyListItem["balance"], t: (k: string, v?: Record<string, string>) => string) {
  if (b.status === "settled") return t("settled");
  return t(b.status, { amount: formatPaise(b.amountPaise) });
}

export default function HomePage() {
  const router = useRouter();
  const { user, isReady, logout } = useAuth();
  const tHome = useTranslations("home");
  const tLedger = useTranslations("ledger");
  const tNav = useTranslations("nav");

  const queryClient = useQueryClient();
  const { data: businesses } = useBusinesses();
  const [activeId, setActiveId] = useState<string>();
  const activeBusinessId = activeId ?? businesses?.[0]?.id;

  // Self-heal: a user with no business (e.g. created before the default-business
  // fix) can't do anything — create one so the app is usable.
  const creatingBiz = useRef(false);
  useEffect(() => {
    if (isReady && user && businesses && businesses.length === 0 && !creatingBiz.current) {
      creatingBiz.current = true;
      api
        .createBusiness({ id: crypto.randomUUID(), name: "My Business" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["businesses"] }))
        .catch(() => {
          creatingBiz.current = false;
        });
    }
  }, [isReady, user, businesses, queryClient]);

  const [tab, setTab] = useState<"customers" | "cashbook">("customers");
  const [search, setSearch] = useState("");
  const [cashFrom, setCashFrom] = useState(() => defaultRange().from);
  const [cashTo, setCashTo] = useState(() => defaultRange().to);
  const [addParty, setAddParty] = useState(false);
  const [cashDir, setCashDir] = useState<"IN" | "OUT" | null>(null);

  const { data: summary } = useSummary(activeBusinessId);
  const { data: parties, isLoading: partiesLoading } = useParties(activeBusinessId);
  const { data: cashbook, isLoading: cashLoading } = useCashbook(activeBusinessId);

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, user, router]);

  const filtered = useMemo(
    () =>
      (parties ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [parties, search],
  );

  // Cashbook filtered by date range and grouped by day (newest first).
  const cashGroups = useMemo(() => {
    const entries = (cashbook?.entries ?? []).filter((e) => {
      const d = e.entryDate.slice(0, 10);
      if (cashFrom && d < cashFrom) return false;
      if (cashTo && d > cashTo) return false;
      return true;
    });
    const byDate = new Map<string, CashEntry[]>();
    for (const e of entries) {
      const key = e.entryDate.slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push(e);
      byDate.set(key, list);
    }
    const groups = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return { groups, net: computeCashbookNet(entries) };
  }, [cashbook, cashFrom, cashTo]);

  if (!isReady || !user) return <Spinner />;

  return (
    <main className="pb-24">
      {/* Header */}
      <header className="flex items-center justify-between bg-accent px-4 py-3 text-white">
        {businesses && businesses.length > 1 ? (
          <select
            className="max-w-[60%] truncate bg-transparent text-base font-semibold outline-none"
            value={activeBusinessId}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id} className="text-gray-900">
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="truncate text-base font-semibold">
            {businesses?.[0]?.name ?? "…"}
          </span>
        )}
        <button className="text-sm underline" onClick={logout}>
          {tHome("logout")}
        </button>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-xl border border-due/20 bg-due/5 p-3">
          <div className="text-xs text-due/80">{tHome("receivable")}</div>
          <div className="text-xl font-bold text-due">
            {formatPaise(summary?.receivablePaise ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border border-settled/20 bg-settled/5 p-3">
          <div className="text-xs text-settled/80">{tHome("payable")}</div>
          <div className="text-xl font-bold text-settled">
            {formatPaise(summary?.payablePaise ?? 0)}
          </div>
        </div>
      </section>

      {/* Quick nav to reports / invoices / inventory */}
      <nav className="flex gap-2 px-4">
        {(
          [
            ["/reports", tNav("reports")],
            ["/invoices", tNav("invoices")],
            ["/inventory", tNav("inventory")],
            ["/settings", tNav("settings")],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="flex-1 rounded-lg bg-white py-2 text-center text-xs font-medium text-gray-600 shadow-sm"
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        {(["customers", "cashbook"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 border-b-2 pb-2 pt-1 text-sm font-semibold ${
              tab === key ? "border-accent text-accent" : "border-transparent text-gray-400"
            }`}
          >
            {tHome(key)}
          </button>
        ))}
      </div>

      {tab === "customers" ? (
        <section className="p-4">
          <input
            className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder={tHome("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {partiesLoading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{tHome("noCustomers")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl bg-white">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/party/${p.id}`}
                    className="flex items-center justify-between px-3 py-3"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {p.type === "SUPPLIER" ? "Supplier" : "Customer"}
                      </div>
                    </div>
                    <div
                      className={`text-right text-sm font-semibold ${
                        p.balance.tone === "due" ? "text-due" : "text-settled"
                      }`}
                    >
                      {balanceLabel(p.balance, tLedger)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="p-4">
          <div className="mb-3 rounded-xl bg-white p-3">
            <div className="text-xs text-gray-400">{tHome("net")}</div>
            <div
              className={`text-xl font-bold ${
                cashGroups.net >= 0 ? "text-settled" : "text-due"
              }`}
            >
              {formatPaise(cashGroups.net)}
            </div>
          </div>

          {/* Date filter */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
              value={cashFrom}
              onChange={(e) => setCashFrom(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
              value={cashTo}
              onChange={(e) => setCashTo(e.target.value)}
            />
          </div>

          {cashLoading ? (
            <Spinner />
          ) : cashGroups.groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{tHome("noCashbook")}</p>
          ) : (
            <div className="space-y-4">
              {cashGroups.groups.map(([date, entries]) => (
                <div key={date}>
                  <div className="mb-1 px-1 text-xs font-semibold text-gray-500">
                    {new Date(date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <ul className="divide-y divide-gray-100 rounded-xl bg-white">
                    {entries.map((e) => (
                      <li key={e.id} className="flex items-start justify-between px-3 py-3">
                        <div>
                          <div className="font-medium">{e.note || e.category || "—"}</div>
                          <div className="text-xs text-gray-400">
                            {e.paymentMode === "ONLINE" ? "Online" : "Cash"}
                          </div>
                          <AttachmentThumbs urls={e.attachments} />
                        </div>
                        <div
                          className={`text-sm font-semibold ${
                            e.direction === "IN" ? "text-settled" : "text-due"
                          }`}
                        >
                          {e.direction === "IN" ? "+" : "−"}
                          {formatPaise(e.amountPaise)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bottom actions */}
      {tab === "customers" ? (
        <button
          onClick={() => setAddParty(true)}
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg"
        >
          + {tHome("addCustomer")}
        </button>
      ) : (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 gap-3">
          <button
            onClick={() => setCashDir("IN")}
            className="flex-1 rounded-xl bg-settled py-3 text-sm font-semibold text-white shadow-lg"
          >
            + {tHome("cashIn")}
          </button>
          <button
            onClick={() => setCashDir("OUT")}
            className="flex-1 rounded-xl bg-due py-3 text-sm font-semibold text-white shadow-lg"
          >
            − {tHome("cashOut")}
          </button>
        </div>
      )}

      {activeBusinessId && (
        <>
          <AddPartySheet
            open={addParty}
            onClose={() => setAddParty(false)}
            businessId={activeBusinessId}
          />
          <AddCashbookSheet
            open={cashDir !== null}
            onClose={() => setCashDir(null)}
            businessId={activeBusinessId}
            direction={cashDir ?? "IN"}
          />
        </>
      )}
    </main>
  );
}
