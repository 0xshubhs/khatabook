"use client";

import { formatPaise } from "@khatabook/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AddTransactionSheet } from "@/components/add-transaction-sheet";
import { AttachmentThumbs } from "@/components/image-upload";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { nativeBridge } from "@/lib/native-bridge";
import { useLedger } from "@/lib/queries";

export default function PartyLedgerPage() {
  const params = useParams<{ id: string }>();
  const partyId = params.id;
  const t = useTranslations("ledger");
  const { data: ledger, isLoading } = useLedger(partyId);
  const [sheet, setSheet] = useState<"CREDIT" | "DEBIT" | null>(null);
  const [reminded, setReminded] = useState(false);

  if (isLoading || !ledger) return <Spinner />;

  const { party, balance } = ledger;
  const toneClass = balance.tone === "due" ? "text-due" : "text-settled";
  const balanceLabel =
    balance.status === "settled"
      ? t("settled")
      : t(balance.status, { amount: formatPaise(balance.amountPaise) });

  // Newest first for display; running balance was computed chronologically.
  const rows = [...ledger.entries].reverse();

  async function remind() {
    await api.remind(partyId);
    setReminded(true);
    setTimeout(() => setReminded(false), 2500);
  }

  async function share() {
    // Uses the RN native share sheet when in the shell, else Web Share / clipboard.
    await nativeBridge.share(`${party.name}: ${balanceLabel} — statement from Khatabook`);
  }

  return (
    <main className="pb-28">
      <header className="bg-accent px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl leading-none">
            ‹
          </Link>
          <div className="flex-1">
            <div className="text-base font-semibold">{party.name}</div>
            {party.phone && <div className="text-xs text-white/70">{party.phone}</div>}
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-white p-3 text-gray-900">
          <div className="text-xs text-gray-400">
            {party.type === "SUPPLIER" ? "Supplier" : "Customer"}
          </div>
          <div className={`text-2xl font-bold ${toneClass}`}>{balanceLabel}</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={remind}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700"
            >
              {reminded ? t("reminderSent") : t("remind")}
            </button>
            <button
              onClick={share}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700"
            >
              {t("share")}
            </button>
            <button
              onClick={() =>
                downloadFile(
                  `/parties/${partyId}/statement.pdf`,
                  `statement-${party.name}.pdf`,
                  "application/pdf",
                )
              }
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700"
            >
              {t("statement")}
            </button>
          </div>
        </div>
      </header>

      <section className="p-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t("noEntries")}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((e) => {
              const gave = e.type === "CREDIT";
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-3"
                >
                  <div>
                    <div className="text-xs text-gray-400">
                      {new Date(e.txnDate).toLocaleDateString("en-IN")}
                    </div>
                    {e.note && <div className="text-sm">{e.note}</div>}
                    <div className="text-[11px] text-gray-400">
                      {t("runningBalance")}: {formatPaise(Math.abs(e.runningBalancePaise))}
                    </div>
                    <AttachmentThumbs urls={e.attachments} />
                  </div>
                  <div className={`text-right font-semibold ${gave ? "text-due" : "text-settled"}`}>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      {gave ? t("gave") : t("got")}
                    </div>
                    {formatPaise(e.amountPaise)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Two large fixed bottom buttons */}
      <div className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 gap-px bg-gray-200">
        <button
          onClick={() => setSheet("CREDIT")}
          className="flex-1 bg-due py-4 text-sm font-bold text-white"
        >
          {t("youGave")}
        </button>
        <button
          onClick={() => setSheet("DEBIT")}
          className="flex-1 bg-settled py-4 text-sm font-bold text-white"
        >
          {t("youGot")}
        </button>
      </div>

      <AddTransactionSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        partyId={partyId}
        businessId={party.businessId}
        type={sheet ?? "CREDIT"}
      />
    </main>
  );
}
