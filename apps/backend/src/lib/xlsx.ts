import ExcelJS from "exceljs";
import type { Response } from "express";
import type { BusinessSummary } from "./reports";

const MONEY_FMT = '₹#,##0.00';

export async function streamSummaryXlsx(
  res: Response,
  opts: { businessName: string; summary: BusinessSummary },
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Khatabook Clone";

  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "k", width: 26 },
    { header: "Amount", key: "v", width: 18 },
  ];
  summary.getRow(1).font = { bold: true };
  const add = (k: string, paise: number) => {
    const row = summary.addRow({ k, v: paise / 100 });
    row.getCell("v").numFmt = MONEY_FMT;
  };
  add("Receivable (you will get)", opts.summary.receivablePaise);
  add("Payable (you will give)", opts.summary.payablePaise);
  add("Cashbook net", opts.summary.cashbookNetPaise);
  add("Sales", opts.summary.salesPaise);
  add("Purchases", opts.summary.purchasesPaise);

  const parties = wb.addWorksheet("Parties");
  parties.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Type", key: "type", width: 12 },
    { header: "Balance", key: "bal", width: 18 },
  ];
  parties.getRow(1).font = { bold: true };
  for (const p of opts.summary.parties) {
    const row = parties.addRow({ name: p.name, type: p.type, bal: p.balancePaise / 100 });
    row.getCell("bal").numFmt = MONEY_FMT;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="summary.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}
