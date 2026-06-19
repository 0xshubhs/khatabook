// Core ledger math (SPEC §5). Pure functions, integer paise, shared by the
// backend (authoritative) and webapp (instant/offline). Soft-deleted rows
// (deletedAt != null) are excluded everywhere.
import type { CashDirection, TransactionType } from "./types";

interface SoftDeletable {
  deletedAt?: Date | string | null;
}

function isActive(x: SoftDeletable): boolean {
  return x.deletedAt == null;
}

export interface SignedTxn extends SoftDeletable {
  type: TransactionType;
  amountPaise: number;
}

/** Party balance = SUM(CREDIT) - SUM(DEBIT). Positive = receivable, negative = payable. */
export function computePartyBalance(txns: SignedTxn[]): number {
  return txns
    .filter(isActive)
    .reduce(
      (acc, t) => acc + (t.type === "CREDIT" ? t.amountPaise : -t.amountPaise),
      0,
    );
}

export interface DatedTxn extends SignedTxn {
  txnDate: Date | string | number;
}

export interface RunningBalanceRow<T> {
  txn: T;
  balancePaise: number;
}

/**
 * Walk transactions oldest -> newest, returning each with the running balance
 * after it (same credit-positive / debit-negative rule).
 */
export function computeRunningBalance<T extends DatedTxn>(
  txns: T[],
): RunningBalanceRow<T>[] {
  const sorted = txns
    .filter(isActive)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime(),
    );
  let running = 0;
  return sorted.map((txn) => {
    running += txn.type === "CREDIT" ? txn.amountPaise : -txn.amountPaise;
    return { txn, balancePaise: running };
  });
}

export interface BusinessTotals {
  receivablePaise: number;
  payablePaise: number;
}

/** Receivable = sum of positive party balances; payable = abs sum of negatives. */
export function computeBusinessTotals(
  partyBalancesPaise: number[],
): BusinessTotals {
  let receivablePaise = 0;
  let payablePaise = 0;
  for (const b of partyBalancesPaise) {
    if (b > 0) receivablePaise += b;
    else if (b < 0) payablePaise += -b;
  }
  return { receivablePaise, payablePaise };
}

export interface CashEntry extends SoftDeletable {
  direction: CashDirection;
  amountPaise: number;
}

/** Cashbook net = SUM(IN) - SUM(OUT). */
export function computeCashbookNet(entries: CashEntry[]): number {
  return entries
    .filter(isActive)
    .reduce(
      (acc, e) => acc + (e.direction === "IN" ? e.amountPaise : -e.amountPaise),
      0,
    );
}

export type BalanceStatus = "due" | "advance" | "settled";

export interface BalanceDescription {
  status: BalanceStatus;
  amountPaise: number; // absolute value, for display
  tone: "due" | "settled"; // due = red, settled = green
}

/** Map a signed balance to a display label + color tone (SPEC §5). */
export function describeBalance(balancePaise: number): BalanceDescription {
  if (balancePaise > 0) {
    return { status: "due", amountPaise: balancePaise, tone: "due" };
  }
  if (balancePaise < 0) {
    return { status: "advance", amountPaise: -balancePaise, tone: "settled" };
  }
  return { status: "settled", amountPaise: 0, tone: "settled" };
}
