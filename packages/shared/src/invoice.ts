// Invoice + inventory helpers (SPEC §3). Integer paise; shared by client + server.

export interface InvoiceItem {
  name: string;
  qty: number;
  ratePaise: number;
}

/** Auto total = sum(qty * ratePaise). */
export function computeInvoiceTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, it) => sum + it.qty * it.ratePaise, 0);
}

/** Low-stock flag: current quantity at or below the threshold. */
export function isLowStock(item: { stockQty: number; lowStockThreshold: number }): boolean {
  return item.stockQty <= item.lowStockThreshold;
}
