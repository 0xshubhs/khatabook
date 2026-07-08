import { prisma } from "@khatabook/database";
import {
  computeBusinessTotals,
  computeCashbookNet,
  computePartyBalance,
} from "@khatabook/shared";

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

/** Build a Prisma date filter from optional ?from&to query params. */
export function parseDateRange(from: unknown, to: unknown): DateRange | undefined {
  const r: DateRange = {};
  if (typeof from === "string" && from) r.gte = new Date(from);
  if (typeof to === "string" && to) r.lte = new Date(to);
  return r.gte || r.lte ? r : undefined;
}

export interface PartySummary {
  name: string;
  type: "CUSTOMER" | "SUPPLIER";
  gavePaise: number; // SUM(CREDIT) — you gave (they owe you)
  gotPaise: number; // SUM(DEBIT) — you got (they paid)
  balancePaise: number; // gave - got
}

export interface TxnDetail {
  date: Date;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  type: "CREDIT" | "DEBIT"; // CREDIT = you gave, DEBIT = you got
  amountPaise: number;
  note: string | null;
}

export interface CashDetail {
  date: Date;
  direction: "IN" | "OUT";
  amountPaise: number;
  paymentMode: string | null;
  note: string | null;
}

export interface BusinessSummary {
  receivablePaise: number;
  payablePaise: number;
  cashbookNetPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  salesPaise: number;
  purchasesPaise: number;
  parties: PartySummary[];
  /** Every ledger entry in the range — which customer, gave or got, how much. */
  transactions: TxnDetail[];
  /** Every cashbook entry in the range — cash in vs out (expenses & income). */
  cashbook: CashDetail[];
  from: Date | null;
  to: Date | null;
}

/** Compute the full business summary. Receivable/payable + per-party gave/got are
 * all-time outstanding; cashbook + the transaction/cashbook detail lists + sales/
 * purchases are bounded by the date range. */
export async function getBusinessSummary(
  businessId: string,
  range?: DateRange,
): Promise<BusinessSummary> {
  const parties = await prisma.party.findMany({
    where: { businessId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
    orderBy: { name: "asc" },
  });
  const partyBalances: PartySummary[] = parties.map((p) => {
    let gavePaise = 0;
    let gotPaise = 0;
    for (const t of p.transactions) {
      if (t.type === "CREDIT") gavePaise += t.amountPaise;
      else gotPaise += t.amountPaise;
    }
    return {
      name: p.name,
      type: p.type,
      gavePaise,
      gotPaise,
      balancePaise: computePartyBalance(p.transactions),
    };
  });
  const { receivablePaise, payablePaise } = computeBusinessTotals(
    partyBalances.map((p) => p.balancePaise),
  );

  const cash = await prisma.cashbookEntry.findMany({
    where: { businessId, deletedAt: null, ...(range ? { entryDate: range } : {}) },
    orderBy: { entryDate: "asc" },
  });
  const cashbookNetPaise = computeCashbookNet(cash);
  let cashInPaise = 0;
  let cashOutPaise = 0;
  for (const e of cash) {
    if (e.direction === "IN") cashInPaise += e.amountPaise;
    else cashOutPaise += e.amountPaise;
  }
  const cashbook: CashDetail[] = cash.map((e) => ({
    date: e.entryDate,
    direction: e.direction,
    amountPaise: e.amountPaise,
    paymentMode: e.paymentMode,
    note: e.note,
  }));

  const txns = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      party: { businessId, deletedAt: null },
      ...(range ? { txnDate: range } : {}),
    },
    include: { party: { select: { type: true, name: true } } },
    orderBy: { txnDate: "asc" },
  });
  let salesPaise = 0;
  let purchasesPaise = 0;
  const transactions: TxnDetail[] = txns.map((t) => {
    if (t.party.type === "CUSTOMER" && t.type === "CREDIT") salesPaise += t.amountPaise;
    if (t.party.type === "SUPPLIER" && t.type === "DEBIT") purchasesPaise += t.amountPaise;
    return {
      date: t.txnDate,
      partyName: t.party.name,
      partyType: t.party.type,
      type: t.type,
      amountPaise: t.amountPaise,
      note: t.note,
    };
  });

  return {
    receivablePaise,
    payablePaise,
    cashbookNetPaise,
    cashInPaise,
    cashOutPaise,
    salesPaise,
    purchasesPaise,
    parties: partyBalances,
    transactions,
    cashbook,
    from: range?.gte ?? null,
    to: range?.lte ?? null,
  };
}
