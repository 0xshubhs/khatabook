"use client";

import { formatPaise } from "@khatabook/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { Button, Spinner } from "@/components/ui";
import { api, rangeQuery } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { useBusinesses } from "@/lib/queries";

export default function ReportsPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const t = useTranslations("reports");
  const tc = useTranslations("common");

  const { data: businesses } = useBusinesses();
  const businessId = businesses?.[0]?.id;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["summary", businessId, from, to],
    queryFn: () => api.getSummary(businessId!, { from, to }),
    enabled: !!businessId,
  });

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, user, router]);

  if (!isReady || !user) return <Spinner />;

  const q = rangeQuery({ from, to });

  const cards: { label: string; paise: number; tone: "due" | "settled" | "plain" }[] = [
    { label: t("receivable"), paise: summary?.receivablePaise ?? 0, tone: "due" },
    { label: t("payable"), paise: summary?.payablePaise ?? 0, tone: "settled" },
    { label: t("net"), paise: summary?.cashbookNetPaise ?? 0, tone: "plain" },
    { label: t("sales"), paise: summary?.salesPaise ?? 0, tone: "plain" },
    { label: t("purchases"), paise: summary?.purchasesPaise ?? 0, tone: "plain" },
  ];

  return (
    <main className="pb-10">
      <header className="flex items-center gap-3 bg-accent px-4 py-3 text-white">
        <Link href="/" className="text-xl leading-none">
          ‹
        </Link>
        <span className="text-base font-semibold">{t("title")}</span>
      </header>

      <section className="grid grid-cols-2 gap-3 p-4">
        <label className="text-xs text-gray-500">
          {t("from")}
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          {t("to")}
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </section>

      {isLoading ? (
        <Spinner />
      ) : (
        <section className="space-y-2 px-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
            >
              <span className="text-sm text-gray-600">{c.label}</span>
              <span
                className={`font-semibold ${
                  c.tone === "due"
                    ? "text-due"
                    : c.tone === "settled"
                      ? "text-settled"
                      : "text-gray-900"
                }`}
              >
                {formatPaise(c.paise)}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 flex gap-3 px-4">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() =>
            businessId &&
            downloadFile(
              `/businesses/${businessId}/reports/summary.pdf${q}`,
              "summary.pdf",
              "application/pdf",
            )
          }
        >
          {t("downloadPdf")}
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() =>
            businessId &&
            downloadFile(
              `/businesses/${businessId}/reports/summary.xlsx${q}`,
              "summary.xlsx",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
          }
        >
          {t("downloadExcel")}
        </Button>
      </section>
    </main>
  );
}
