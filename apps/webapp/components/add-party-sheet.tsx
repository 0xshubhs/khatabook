"use client";

import type { PartyType } from "@khatabook/shared";
import { parseRupeesToPaise } from "@khatabook/shared";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { nativeBridge } from "@/lib/native-bridge";
import { useCreateParty } from "@/lib/queries";
import { BottomSheet, Button, Field, inputClass } from "./ui";

export function AddPartySheet({
  open,
  onClose,
  businessId,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
}) {
  const t = useTranslations("party");
  const create = useCreateParty(businessId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [opening, setOpening] = useState("");
  const [openingType, setOpeningType] = useState<"GOT" | "GAVE">("GOT");
  const [type, setType] = useState<PartyType>("CUSTOMER");
  const [showMore, setShowMore] = useState(false);
  const [gstin, setGstin] = useState("");
  const [flat, setFlat] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const [nativeReady, setNativeReady] = useState(false);
  useEffect(() => setNativeReady(nativeBridge.isAvailable()), []);

  function reset() {
    setName("");
    setPhone("");
    setOpening("");
    setOpeningType("GOT");
    setType("CUSTOMER");
    setShowMore(false);
    setGstin("");
    setFlat("");
    setArea("");
    setPincode("");
    setCity("");
    setStateName("");
    setSameAsBilling(true);
  }

  async function importContact() {
    const c = await nativeBridge.pickContact();
    if (c) {
      setName(c.name);
      setPhone(c.phone.replace(/\D/g, "").slice(-10));
    }
  }

  function save() {
    if (!name.trim()) return;
    const digits = phone.replace(/\D/g, "");
    let openingBalancePaise: number | undefined;
    try {
      const p = opening ? parseRupeesToPaise(opening) : 0;
      openingBalancePaise = p > 0 ? p : undefined;
    } catch {
      openingBalancePaise = undefined;
    }
    const hasAddress = flat || area || pincode || city || stateName;

    create.mutate({
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: digits ? `+91${digits}` : undefined,
      type,
      gstin: gstin.trim() || undefined,
      address: hasAddress
        ? { flat, area, pincode, city, state: stateName, shippingSameAsBilling: sameAsBilling }
        : undefined,
      openingBalancePaise,
      openingBalanceType: openingBalancePaise ? openingType : undefined,
    });
    reset();
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("addTitle")}>
      {nativeReady && (
        <button
          onClick={importContact}
          className="mb-3 w-full rounded-xl border border-accent/30 bg-accent/5 py-2 text-sm font-medium text-accent"
        >
          {t("importContacts")}
        </button>
      )}

      <Field label={t("name")}>
        <input
          className={inputClass}
          autoFocus
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <label className="mb-3 block">
        <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span>{t("phone")}</span>
          <span className="text-gray-400">{t("optional")}</span>
        </span>
        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50">
          <span className="px-3 text-sm text-gray-500">+91</span>
          <input
            className="w-full rounded-r-xl bg-transparent px-2 py-3 outline-none"
            inputMode="numeric"
            maxLength={10}
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </label>

      <label className="mb-3 block">
        <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span>{t("openingBalance")}</span>
          <span className="text-gray-400">{t("optional")}</span>
        </span>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3">
            <span className="text-gray-400">₹</span>
            <input
              className="w-full bg-transparent px-2 py-3 outline-none"
              inputMode="numeric"
              placeholder="0"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </div>
          <select
            className={`rounded-xl border border-gray-200 px-2 py-3 text-sm font-medium ${
              openingType === "GOT" ? "text-settled" : "text-due"
            }`}
            value={openingType}
            onChange={(e) => setOpeningType(e.target.value as "GOT" | "GAVE")}
          >
            <option value="GOT">{t("youGot")}</option>
            <option value="GAVE">{t("youGave")}</option>
          </select>
        </div>
      </label>

      <div className="mb-3">
        <div className="mb-1 text-xs font-medium text-gray-500">{t("whoAreThey")}</div>
        <div className="flex gap-6">
          {(["CUSTOMER", "SUPPLIER"] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="partyType"
                checked={type === opt}
                onChange={() => setType(opt)}
              />
              {opt === "CUSTOMER" ? t("customer") : t("supplier")}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="mb-3 flex w-full items-center justify-between border-t border-gray-100 pt-3 text-sm font-medium text-accent"
      >
        {t("addGstinAddress")}
        <span>{showMore ? "▲" : "▼"}</span>
      </button>

      {showMore && (
        <div className="mb-3">
          <Field label={t("gstin")}>
            <input
              className={inputClass}
              placeholder={t("gstinPlaceholder")}
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
          </Field>
          <div className="mb-2 text-sm font-semibold">{t("shippingAddress")}</div>
          <Field label={t("flat")}>
            <input className={inputClass} value={flat} onChange={(e) => setFlat(e.target.value)} />
          </Field>
          <Field label={t("area")}>
            <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label={t("pincode")}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("city")}>
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label={t("state")}>
              <input
                className={inputClass}
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
            />
            {t("sameAsBilling")}
          </label>
        </div>
      )}

      <Button className="mt-2 w-full" disabled={!name.trim()} onClick={save}>
        {t("save")}
      </Button>
    </BottomSheet>
  );
}
