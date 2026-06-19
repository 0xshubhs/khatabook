"use client";

import { parseRupeesToPaise } from "@khatabook/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCreateTransaction } from "@/lib/queries";
import { MultiImageUpload } from "./image-upload";
import { BottomSheet, Button, Field, inputClass } from "./ui";

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionSheet({
  open,
  onClose,
  partyId,
  businessId,
  type,
}: {
  open: boolean;
  onClose: () => void;
  partyId: string;
  businessId?: string;
  type: "CREDIT" | "DEBIT";
}) {
  const t = useTranslations("entry");
  const create = useCreateTransaction(businessId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayInput());
  const [attachments, setAttachments] = useState<string[]>([]);

  let amountPaise = 0;
  try {
    amountPaise = parseRupeesToPaise(amount);
  } catch {
    amountPaise = 0;
  }
  const valid = amountPaise > 0;

  function reset() {
    setAmount("");
    setNote("");
    setDate(todayInput());
    setAttachments([]);
  }

  function save() {
    if (!valid) return;
    create.mutate({
      id: crypto.randomUUID(),
      partyId,
      type,
      amountPaise,
      note: note.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
      txnDate: new Date(date).toISOString(),
    });
    reset();
    onClose(); // optimistic — the ledger already reflects it
  }

  const title = type === "CREDIT" ? t("youGaveTitle") : t("youGotTitle");

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
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
      <Field label={t("note")}>
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
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
        variant={type === "CREDIT" ? "due" : "settled"}
        className="mt-2 w-full"
        disabled={!valid}
        onClick={save}
      >
        {t("save")}
      </Button>
    </BottomSheet>
  );
}
