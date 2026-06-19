import { describe, expect, it } from "vitest";
import { computeInvoiceTotal, isLowStock } from "./invoice";

describe("computeInvoiceTotal", () => {
  it("sums qty * ratePaise across line items", () => {
    expect(
      computeInvoiceTotal([
        { name: "Rice", qty: 2, ratePaise: 120000 },
        { name: "Sugar", qty: 3, ratePaise: 4500 },
      ]),
    ).toBe(253500); // 240000 + 13500
  });
  it("empty -> 0", () => expect(computeInvoiceTotal([])).toBe(0));
});

describe("isLowStock", () => {
  it("true at or below threshold", () => {
    expect(isLowStock({ stockQty: 8, lowStockThreshold: 12 })).toBe(true);
    expect(isLowStock({ stockQty: 12, lowStockThreshold: 12 })).toBe(true);
  });
  it("false above threshold", () =>
    expect(isLowStock({ stockQty: 40, lowStockThreshold: 10 })).toBe(false));
});
