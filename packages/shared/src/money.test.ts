import { describe, expect, it } from "vitest";
import { formatPaise, PAISE_PER_RUPEE, parseRupeesToPaise } from "./money";

describe("parseRupeesToPaise", () => {
  it("parses whole rupees", () => expect(parseRupeesToPaise("500")).toBe(50000));
  it("parses two decimals", () => expect(parseRupeesToPaise("19.99")).toBe(1999));
  it("parses one decimal as tens of paise", () =>
    expect(parseRupeesToPaise("19.9")).toBe(1990));
  it("strips ₹ and Indian-grouped commas", () =>
    expect(parseRupeesToPaise("₹1,234.56")).toBe(123456));
  it("handles negatives", () => expect(parseRupeesToPaise("-12.34")).toBe(-1234));
  it("treats empty as zero", () => expect(parseRupeesToPaise("")).toBe(0));
  it("accepts a number input", () => expect(parseRupeesToPaise(500)).toBe(50000));
  it("throws on non-numeric", () => expect(() => parseRupeesToPaise("abc")).toThrow());
  it("throws on >2 decimals", () => expect(() => parseRupeesToPaise("1.234")).toThrow());
});

describe("formatPaise", () => {
  it("whole rupees: no decimals, Indian grouping", () =>
    expect(formatPaise(225000)).toBe("₹2,250"));
  it("with paise: two decimals", () => expect(formatPaise(123456)).toBe("₹1,234.56"));
  it("Indian lakh grouping", () => expect(formatPaise(10000000)).toBe("₹1,00,000"));
  it("withSymbol: false drops the ₹", () =>
    expect(formatPaise(50000, { withSymbol: false })).toBe("500"));
  it("negative", () => expect(formatPaise(-30000)).toBe("-₹300"));
  it("zero", () => expect(formatPaise(0)).toBe("₹0"));
  it("PAISE_PER_RUPEE is 100", () => expect(PAISE_PER_RUPEE).toBe(100));
  it("round-trips parse -> format", () =>
    expect(formatPaise(parseRupeesToPaise("1,00,000.50"), { withSymbol: false })).toBe(
      "1,00,000.50",
    ));
});
