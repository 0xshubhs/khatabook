"use client";

import { parseRupeesToPaise } from "@khatabook/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCreateCashbook } from "@/lib/queries";
import { MultiImageUpload } from "./image-upload";
import { BottomSheet, Button, Field, inputClass } from "./ui";

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddCashbookSheet({
  open,
  onClose,
  businessId,
  direction,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  direction: "IN" | "OUT";
}) {
  const t = useTranslations("entry");
  const create = useCreateCashbook(businessId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [date, setDate] = useState(todayInput());
  const [attachments, setAttachments] = useState<string[]>([]);

  let amountPaise = 0;
  try {
    amountPaise = parseRupeesToPaise(amount);
  } catch {
    amountPaise = 0;
  }
  const valid = amountPaise > 0;

  function save() {
    if (!valid) return;
    create.mutate({
      id: crypto.randomUUID(),
      businessId,
      direction,
      amountPaise,
      paymentMode,
      note: note.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
    });
    setAmount("");
    setNote("");
    setPaymentMode("CASH");
    setDate(todayInput());
    setAttachments([]);
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={direction === "IN" ? t("cashInTitle") : t("cashOutTitle")}
    >
      <Field label={t("amount")}>
        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3">
          <span className="text-lg text-gray-400">₹</span>
          <input
            className="w-full bg-transparent px-2 py-3 text-2xl font-semibold outline-none"
            inputMode="numeric"
            autoFocus
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </Field>

      <Field label={t("description")}>
        <textarea
          className={`${inputClass} min-h-[72px] resize-none`}
          placeholder={t("descriptionPlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div className="mb-3">
        <div className="mb-1 text-xs font-medium text-gray-500">{t("paymentMode")}</div>
        <div className="flex gap-6">
          {(["CASH", "ONLINE"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="paymentMode"
                checked={paymentMode === m}
                onChange={() => setPaymentMode(m)}
              />
              {m === "CASH" ? t("cash") : t("online")}
            </label>
          ))}
        </div>
      </div>

      <Field label={t("date")}>
        <input
          type="date"
          className={inputClass}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <MultiImageUpload label={t("attachBill")} value={attachments} onChange={setAttachments} />

      <Button
        variant={direction === "IN" ? "settled" : "due"}
        className="mt-2 w-full"
        disabled={!valid}
        onClick={save}
      >
        {t("save")}
      </Button>
    </BottomSheet>
  );
}
