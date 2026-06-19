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

export interface BusinessSummary {
  receivablePaise: number;
  payablePaise: number;
  cashbookNetPaise: number;
  salesPaise: number;
  purchasesPaise: number;
  parties: { name: string; type: "CUSTOMER" | "SUPPLIER"; balancePaise: number }[];
  from: Date | null;
  to: Date | null;
}

/** Compute the full business summary. Receivable/payable are all-time outstanding
 * balances; cashbook net + sales/purchases are bounded by the date range. */
export async function getBusinessSummary(
  businessId: string,
  range?: DateRange,
): Promise<BusinessSummary> {
  const parties = await prisma.party.findMany({
    where: { businessId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
    orderBy: { name: "asc" },
  });
  const partyBalances = parties.map((p) => ({
    name: p.name,
    type: p.type,
    balancePaise: computePartyBalance(p.transactions),
  }));
  const { receivablePaise, payablePaise } = computeBusinessTotals(
    partyBalances.map((p) => p.balancePaise),
  );

  const cash = await prisma.cashbookEntry.findMany({
    where: { businessId, deletedAt: null, ...(range ? { entryDate: range } : {}) },
  });
  const cashbookNetPaise = computeCashbookNet(cash);

  const txns = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      party: { businessId, deletedAt: null },
      ...(range ? { txnDate: range } : {}),
    },
    include: { party: { select: { type: true } } },
  });
  let salesPaise = 0;
  let purchasesPaise = 0;
  for (const t of txns) {
    if (t.party.type === "CUSTOMER" && t.type === "CREDIT") salesPaise += t.amountPaise;
    if (t.party.type === "SUPPLIER" && t.type === "DEBIT") purchasesPaise += t.amountPaise;
  }

  return {
    receivablePaise,
    payablePaise,
    cashbookNetPaise,
    salesPaise,
    purchasesPaise,
    parties: partyBalances,
    from: range?.gte ?? null,
    to: range?.lte ?? null,
  };
}
