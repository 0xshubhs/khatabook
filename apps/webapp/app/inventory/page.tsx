"use client";

import { formatPaise, parseRupeesToPaise } from "@khatabook/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { BottomSheet, Button, Field, Spinner, inputClass } from "@/components/ui";
import { useBusinesses, useCreateInventory, useInventory, useUpdateInventory } from "@/lib/queries";

export default function InventoryPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const t = useTranslations("inventory");
  const { data: businesses } = useBusinesses();
  const businessId = businesses?.[0]?.id;
  const { data: items, isLoading } = useInventory(businessId);
  const create = useCreateInventory(businessId ?? "");
  const update = useUpdateInventory(businessId ?? "");

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, user, router]);

  if (!isReady || !user) return <Spinner />;

  function save() {
    if (!businessId || !name.trim()) return;
    create.mutate({
      id: crypto.randomUUID(),
      businessId,
      name: name.trim(),
      stockQty: Number(stock || 0),
      lowStockThreshold: Number(threshold || 0),
      pricePaise: price ? parseRupeesToPaise(price) : 0,
    });
    setName("");
    setStock("");
    setThreshold("");
    setPrice("");
    setAdding(false);
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
        {isLoading ? (
          <Spinner />
        ) : (items?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {items!.map((item) => (
              <li key={item.id} className="rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {item.name}
                    {item.lowStock && (
                      <span className="ml-2 rounded-full bg-due/10 px-2 py-0.5 text-[10px] font-semibold text-due">
                        {t("lowStock")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{formatPaise(item.pricePaise)}</div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm">
                    {t("stock")}: <b>{item.stockQty}</b>{" "}
                    <span className="text-xs text-gray-400">({t("threshold")} {item.lowStockThreshold})</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      className="rounded-lg bg-settled/10 px-3 py-1 text-sm font-semibold text-settled"
                      onClick={() => update.mutate({ id: item.id, stockDelta: 1 })}
                    >
                      {t("in")}
                    </button>
                    <button
                      className="rounded-lg bg-due/10 px-3 py-1 text-sm font-semibold text-due"
                      onClick={() => update.mutate({ id: item.id, stockDelta: -1 })}
                    >
                      {t("out")}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => setAdding(true)}
        className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg"
      >
        + {t("add")}
      </button>

      <BottomSheet open={adding} onClose={() => setAdding(false)} title={t("add")}>
        <Field label={t("name")}>
          <input className={inputClass} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("stock")}>
            <input className={inputClass} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          </Field>
          <Field label={t("threshold")}>
            <input className={inputClass} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
        </div>
        <Field label={t("price")}>
          <input className={inputClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Button className="mt-2 w-full" disabled={!name.trim()} onClick={save}>
          {t("save")}
        </Button>
      </BottomSheet>
    </main>
  );
}
