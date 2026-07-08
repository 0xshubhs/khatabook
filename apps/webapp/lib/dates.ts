/** Local YYYY-MM-DD (NOT toISOString — that shifts to UTC and can be off by a day in IST). */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayInput(): string {
  return toDateInput(new Date());
}

/**
 * Default range for date-range FILTERS so they aren't blank on first load.
 * From the 1st of *last* month through today — wide enough to show recent
 * history (and the seed data) without looking empty like a "this month" default would.
 */
export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { from: toDateInput(from), to: toDateInput(now) };
}
