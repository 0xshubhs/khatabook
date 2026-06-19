// Money helpers. Everything is integer paise internally; we only touch rupees
// at the display/parse boundary (SPEC §2).

export const PAISE_PER_RUPEE = 100;

const MONEY_INPUT_RE = /^-?\d+(\.\d{1,2})?$/;

/**
 * Parse a user-entered rupee string (e.g. "₹1,234.56", "500", "-12.3") into
 * integer paise. String-based (no float math) so amounts are always exact.
 * Throws on malformed input; empty string -> 0.
 */
export function parseRupeesToPaise(input: string | number): number {
  const cleaned = String(input).replace(/[₹,\s]/g, "").trim();
  if (cleaned === "") return 0;
  if (!MONEY_INPUT_RE.test(cleaned)) {
    throw new Error(`Invalid money input: "${input}"`);
  }
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace(/^-/, "").split(".");
  const paiseFrac = (frac + "00").slice(0, 2);
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(paiseFrac);
  return negative ? -paise : paise;
}

/**
 * Format integer paise for display using Indian digit grouping. Whole-rupee
 * amounts show no decimals; otherwise two. `withSymbol` prepends ₹ (default on).
 */
export function formatPaise(
  paise: number,
  opts: { withSymbol?: boolean } = {},
): string {
  const { withSymbol = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const hasPaise = abs % PAISE_PER_RUPEE !== 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs / PAISE_PER_RUPEE);
  return `${negative ? "-" : ""}${withSymbol ? "₹" : ""}${formatted}`;
}
