"use client";

import { computeInvoiceTotal, formatPaise, parseRupeesToPaise } from "@khatabook/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { BottomSheet, Button, Field, Spinner, inputClass } from "@/components/ui";
import { downloadFile } from "@/lib/download";
import { useBusinesses, useCreateInvoice, useInvoices, useParties } from "@/lib/queries";

interface DraftLine {
  name: string;
  qty: string;
  rate: string;
}

const emptyLine: DraftLine = { name: "", qty: "1", rate: "" };

export default function InvoicesPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const t = useTranslations("invoices");
  const { data: businesses } = useBusinesses();
  const businessId = businesses?.[0]?.id;
  const { data: invoices, isLoading } = useInvoices(businessId);
  const { data: parties } = useParties(businessId);
  const create = useCreateInvoice(businessId ?? "");

  const [creating, setCreating] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, user, router]);

  if (!isReady || !user) return <Spinner />;

  const shown = (invoices ?? []).filter((inv) => {
    const d = inv.createdAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const parsedItems = lines
    .filter((l) => l.name.trim() && l.rate)
    .map((l) => ({
      name: l.name.trim(),
      qty: Math.max(1, Number(l.qty || 1)),
      ratePaise: (() => {
        try {
          return parseRupeesToPaise(l.rate);
        } catch {
          return 0;
        }
      })(),
    }));
  const totalPaise = computeInvoiceTotal(parsedItems);

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function save() {
    if (!businessId || parsedItems.length === 0) return;
    create.mutate({
      id: crypto.randomUUID(),
      businessId,
      partyId: partyId || undefined,
      items: parsedItems,
    });
    setLines([{ ...emptyLine }]);
    setPartyId("");
    setCreating(false);
  }

  return (
    <main className="pb-24">
      <header className="flex items-center gap-3 bg-accent px-4 py-3 text-white">
        <Link href="/" className="text-xl leading-none">
          ‹
        </Link>
        <span className="text-base font-semibold">{t("title")}</span>
      </header>

      <section className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input
            type="date"
            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {isLoading ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <div>
                  <div className="font-medium">
                    {t("number")} {inv.number}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN")} · {inv.items.length} items
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatPaise(inv.totalPaise)}</span>
                  <button
                    className="rounded-lg border border-gray-200 px-3 py-1 text-sm"
                    onClick={() =>
                      downloadFile(
                        `/invoices/${inv.id}/pdf`,
                        `invoice-${inv.number}.pdf`,
                        "application/pdf",
                      )
                    }
                  >
                    {t("pdf")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg"
      >
        + {t("create")}
      </button>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title={t("create")}>
        {parties && parties.length > 0 && (
          <Field label="Customer">
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">—</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {lines.map((line, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_3rem_4rem] gap-2">
            <input
              className={inputClass}
              placeholder={t("itemName")}
              value={line.name}
              onChange={(e) => setLine(i, { name: e.target.value })}
            />
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder={t("qty")}
              value={line.qty}
              onChange={(e) => setLine(i, { qty: e.target.value })}
            />
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder={t("rate")}
              value={line.rate}
              onChange={(e) => setLine(i, { rate: e.target.value })}
            />
          </div>
        ))}
        <button
          className="mb-3 text-sm font-medium text-accent"
          onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
        >
          {t("addLine")}
        </button>

        <div className="mb-3 flex justify-between border-t border-gray-100 pt-3 text-base font-semibold">
          <span>{t("total")}</span>
          <span>{formatPaise(totalPaise)}</span>
        </div>

        <Button className="w-full" disabled={parsedItems.length === 0} onClick={save}>
          {t("save")}
        </Button>
      </BottomSheet>
    </main>
  );
}
