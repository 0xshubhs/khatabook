import ExcelJS from "exceljs";
import type { Response } from "express";
import type { BusinessSummary } from "./reports";

const MONEY_FMT = '₹#,##0.00';
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-IN");

export async function streamSummaryXlsx(
  res: Response,
  opts: { businessName: string; summary: BusinessSummary },
): Promise<void> {
  const s = opts.summary;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Khatabook Clone";

  // ---- Summary ----
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "k", width: 30 },
    { header: "Amount", key: "v", width: 18 },
  ];
  summary.getRow(1).font = { bold: true };
  summary.addRow({ k: opts.businessName });
  if (s.from || s.to) {
    summary.addRow({
      k: `Period: ${s.from ? fmtDate(s.from) : "start"} – ${s.to ? fmtDate(s.to) : "today"}`,
    });
  }
  const add = (k: string, paise: number) => {
    const row = summary.addRow({ k, v: paise / 100 });
    row.getCell("v").numFmt = MONEY_FMT;
  };
  add("Receivable (you will get)", s.receivablePaise);
  add("Payable (you will give)", s.payablePaise);
  add("Cash In", s.cashInPaise);
  add("Cash Out", s.cashOutPaise);
  add("Cashbook net", s.cashbookNetPaise);
  add("Sales", s.salesPaise);
  add("Purchases", s.purchasesPaise);

  // ---- Parties: per-customer you gave / you got / balance ----
  const parties = wb.addWorksheet("Parties");
  parties.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Type", key: "type", width: 12 },
    { header: "You Gave", key: "gave", width: 16 },
    { header: "You Got", key: "got", width: 16 },
    { header: "Balance", key: "bal", width: 18 },
  ];
  parties.getRow(1).font = { bold: true };
  for (const p of s.parties) {
    const row = parties.addRow({
      name: p.name,
      type: p.type,
      gave: p.gavePaise / 100,
      got: p.gotPaise / 100,
      bal: p.balancePaise / 100,
    });
    for (const c of ["gave", "got", "bal"]) row.getCell(c).numFmt = MONEY_FMT;
  }

  // ---- Transactions: which customer, gave or got, how much ----
  const txns = wb.addWorksheet("Transactions");
  txns.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Customer / Supplier", key: "party", width: 26 },
    { header: "Type", key: "type", width: 12 },
    { header: "You Gave", key: "gave", width: 16 },
    { header: "You Got", key: "got", width: 16 },
    { header: "Note", key: "note", width: 30 },
  ];
  txns.getRow(1).font = { bold: true };
  for (const t of s.transactions) {
    const row = txns.addRow({
      date: fmtDate(t.date),
      party: t.partyName,
      type: t.type === "CREDIT" ? "You Gave" : "You Got",
      gave: t.type === "CREDIT" ? t.amountPaise / 100 : null,
      got: t.type === "DEBIT" ? t.amountPaise / 100 : null,
      note: t.note ?? "",
    });
    for (const c of ["gave", "got"]) row.getCell(c).numFmt = MONEY_FMT;
  }
  if (s.transactions.length === 0) txns.addRow({ date: "No transactions in this period" });

  // ---- Cashbook: cash in vs out (income & expenses) ----
  const cb = wb.addWorksheet("Cashbook");
  cb.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 12 },
    { header: "Cash In", key: "in", width: 16 },
    { header: "Cash Out", key: "out", width: 16 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Note", key: "note", width: 30 },
  ];
  cb.getRow(1).font = { bold: true };
  for (const e of s.cashbook) {
    const row = cb.addRow({
      date: fmtDate(e.date),
      type: e.direction === "IN" ? "Cash In" : "Cash Out",
      in: e.direction === "IN" ? e.amountPaise / 100 : null,
      out: e.direction === "OUT" ? e.amountPaise / 100 : null,
      mode: e.paymentMode ?? "",
      note: e.note ?? "",
    });
    for (const c of ["in", "out"]) row.getCell(c).numFmt = MONEY_FMT;
  }
  if (s.cashbook.length === 0) cb.addRow({ date: "No cash entries in this period" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="report.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}
