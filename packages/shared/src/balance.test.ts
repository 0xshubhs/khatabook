import { describe, expect, it } from "vitest";
import {
  computeBusinessTotals,
  computeCashbookNet,
  computePartyBalance,
  computeRunningBalance,
  describeBalance,
  type CashEntry,
  type DatedTxn,
  type SignedTxn,
} from "./balance";

describe("computePartyBalance", () => {
  it("credit positive, debit negative (Ramesh: +30000)", () => {
    const txns: SignedTxn[] = [
      { type: "CREDIT", amountPaise: 50000 },
      { type: "DEBIT", amountPaise: 20000 },
      { type: "CREDIT", amountPaise: 30000 },
      { type: "DEBIT", amountPaise: 30000 },
    ];
    expect(computePartyBalance(txns)).toBe(30000);
  });
  it("excludes soft-deleted rows", () => {
    const txns: SignedTxn[] = [
      { type: "CREDIT", amountPaise: 1000 },
      { type: "CREDIT", amountPaise: 5000, deletedAt: "2026-01-01" },
    ];
    expect(computePartyBalance(txns)).toBe(1000);
  });
  it("empty -> 0", () => expect(computePartyBalance([])).toBe(0));
});

describe("computeRunningBalance", () => {
  it("walks oldest -> newest regardless of input order", () => {
    const txns: DatedTxn[] = [
      { type: "DEBIT", amountPaise: 30000, txnDate: "2026-01-04" },
      { type: "CREDIT", amountPaise: 50000, txnDate: "2026-01-01" },
      { type: "DEBIT", amountPaise: 20000, txnDate: "2026-01-02" },
      { type: "CREDIT", amountPaise: 30000, txnDate: "2026-01-03" },
    ];
    expect(computeRunningBalance(txns).map((r) => r.balancePaise)).toEqual([
      50000, 30000, 60000, 30000,
    ]);
  });
});

describe("computeBusinessTotals", () => {
  it("receivable = sum positive, payable = abs sum negative (seed totals)", () => {
    expect(computeBusinessTotals([30000, 75000, 120000, -150000, -80000])).toEqual({
      receivablePaise: 225000,
      payablePaise: 230000,
    });
  });
});

describe("computeCashbookNet", () => {
  it("IN positive, OUT negative (seed net: +180000)", () => {
    const entries: CashEntry[] = [
      { direction: "IN", amountPaise: 500000 },
      { direction: "IN", amountPaise: 350000 },
      { direction: "IN", amountPaise: 420000 },
      { direction: "IN", amountPaise: 80000 },
      { direction: "IN", amountPaise: 600000 },
      { direction: "OUT", amountPaise: 1000000 },
      { direction: "OUT", amountPaise: 600000 },
      { direction: "OUT", amountPaise: 45000 },
      { direction: "OUT", amountPaise: 120000 },
      { direction: "OUT", amountPaise: 5000 },
    ];
    expect(computeCashbookNet(entries)).toBe(180000);
  });
});

describe("describeBalance", () => {
  it("positive -> due / red", () =>
    expect(describeBalance(30000)).toEqual({
      status: "due",
      amountPaise: 30000,
      tone: "due",
    }));
  it("negative -> advance / green", () =>
    expect(describeBalance(-80000)).toEqual({
      status: "advance",
      amountPaise: 80000,
      tone: "settled",
    }));
  it("zero -> settled", () =>
    expect(describeBalance(0)).toEqual({
      status: "settled",
      amountPaise: 0,
      tone: "settled",
    }));
});
