import { computeRunningBalance, describeBalance, formatPaise } from "@khatabook/shared";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import type { BusinessSummary } from "./reports";

// Helvetica (pdfkit's default) lacks the ₹ glyph, so use "Rs " in PDFs.
const rs = (paise: number) => `Rs ${formatPaise(paise, { withSymbol: false })}`;

interface StatementTxn {
  type: "CREDIT" | "DEBIT";
  amountPaise: number;
  note: string | null;
  txnDate: Date;
  deletedAt?: Date | null;
}

export function streamStatementPdf(
  res: Response,
  opts: { partyName: string; partyPhone: string | null; entries: StatementTxn[] },
): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="statement.pdf"');
  doc.pipe(res);

  const rows = computeRunningBalance(opts.entries);
  const balancePaise = rows.length ? rows[rows.length - 1].balancePaise : 0;
  const desc = describeBalance(balancePaise);

  doc.fontSize(20).text("Account Statement");
  doc.moveDown(0.3).fontSize(12).fillColor("#555").text(opts.partyName);
  if (opts.partyPhone) doc.text(opts.partyPhone);
  doc
    .moveDown(0.5)
    .fillColor("#000")
    .fontSize(12)
    .text(`Balance: ${rs(desc.amountPaise)} ${desc.status}`);
  doc.moveDown(1);

  const cols = { date: 40, details: 130, gave: 300, got: 380, bal: 460 };
  const top = doc.y;
  doc.fontSize(10).fillColor("#888");
  doc.text("Date", cols.date, top, { width: 90 });
  doc.text("Details", cols.details, top, { width: 170 });
  doc.text("Gave", cols.gave, top, { width: 80, align: "right" });
  doc.text("Got", cols.got, top, { width: 80, align: "right" });
  doc.text("Balance", cols.bal, top, { width: 90, align: "right" });
  doc.moveTo(40, top + 15).lineTo(550, top + 15).stroke("#dddddd");

  let y = top + 22;
  doc.fillColor("#000").fontSize(9);
  for (const r of rows) {
    const e = r.txn;
    doc.text(new Date(e.txnDate).toLocaleDateString("en-IN"), cols.date, y, { width: 90 });
    doc.text(e.note ?? "-", cols.details, y, { width: 170 });
    doc.text(e.type === "CREDIT" ? formatPaise(e.amountPaise, { withSymbol: false }) : "", cols.gave, y, { width: 80, align: "right" });
    doc.text(e.type === "DEBIT" ? formatPaise(e.amountPaise, { withSymbol: false }) : "", cols.got, y, { width: 80, align: "right" });
    doc.text(formatPaise(r.balancePaise, { withSymbol: false }), cols.bal, y, { width: 90, align: "right" });
    y += 18;
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
  }
  if (rows.length === 0) doc.text("No transactions yet.", 40, y);

  doc.end();
}

export function streamInvoicePdf(
  res: Response,
  opts: {
    businessName: string;
    number: string;
    partyName: string | null;
    createdAt: Date;
    items: { name: string; qty: number; ratePaise: number }[];
    totalPaise: number;
  },
): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${opts.number}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text("Invoice");
  doc.moveDown(0.3).fontSize(12).fillColor("#555").text(opts.businessName);
  doc.fillColor("#000").text(`Invoice #: ${opts.number}`);
  doc.text(`Date: ${new Date(opts.createdAt).toLocaleDateString("en-IN")}`);
  if (opts.partyName) doc.text(`Bill to: ${opts.partyName}`);
  doc.moveDown(1);

  const cols = { name: 40, qty: 320, rate: 380, amt: 470 };
  const top = doc.y;
  doc.fontSize(10).fillColor("#888");
  doc.text("Item", cols.name, top, { width: 270 });
  doc.text("Qty", cols.qty, top, { width: 50, align: "right" });
  doc.text("Rate", cols.rate, top, { width: 80, align: "right" });
  doc.text("Amount", cols.amt, top, { width: 80, align: "right" });
  doc.moveTo(40, top + 15).lineTo(550, top + 15).stroke("#dddddd");

  let y = top + 22;
  doc.fillColor("#000").fontSize(10);
  for (const it of opts.items) {
    doc.text(it.name, cols.name, y, { width: 270 });
    doc.text(String(it.qty), cols.qty, y, { width: 50, align: "right" });
    doc.text(formatPaise(it.ratePaise, { withSymbol: false }), cols.rate, y, { width: 80, align: "right" });
    doc.text(formatPaise(it.qty * it.ratePaise, { withSymbol: false }), cols.amt, y, { width: 80, align: "right" });
    y += 18;
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
  }
  doc.moveTo(40, y + 4).lineTo(550, y + 4).stroke("#dddddd");
  doc.fontSize(12).text(`Total: ${rs(opts.totalPaise)}`, cols.name, y + 12, {
    width: 510,
    align: "right",
  });
  doc.end();
}

export function streamSummaryPdf(
  res: Response,
  opts: { businessName: string; summary: BusinessSummary },
): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
  doc.pipe(res);

  const s = opts.summary;
  const date = (d: Date) => new Date(d).toLocaleDateString("en-IN");
  const num = (paise: number) => formatPaise(paise, { withSymbol: false });
  const clip = (str: string, n: number) => (str.length > n ? str.slice(0, n - 1) + "…" : str);

  doc.fontSize(20).text("Business Report");
  doc.moveDown(0.3).fontSize(12).fillColor("#555").text(opts.businessName);
  if (s.from || s.to) {
    doc.text(`Period: ${s.from ? date(s.from) : "start"} - ${s.to ? date(s.to) : "today"}`);
  }
  doc.moveDown(0.8).fillColor("#000").fontSize(12);
  const line = (label: string, paise: number) => doc.text(`${label}: ${rs(paise)}`);
  line("You will get (receivable)", s.receivablePaise);
  line("You will give (payable)", s.payablePaise);
  line("Cash In", s.cashInPaise);
  line("Cash Out", s.cashOutPaise);
  line("Cashbook net", s.cashbookNetPaise);
  line("Sales", s.salesPaise);
  line("Purchases", s.purchasesPaise);

  type Col = { label: string; x: number; width: number; align?: "left" | "right" };
  const drawTable = (title: string, cols: Col[], rows: string[][], empty: string) => {
    let y = doc.y + 18;
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
    doc.fontSize(13).fillColor("#000").text(title, 40, y);
    y += 20;
    const head = () => {
      doc.fontSize(9).fillColor("#888");
      for (const c of cols)
        doc.text(c.label, c.x, y, { width: c.width, align: c.align ?? "left", lineBreak: false });
      doc.moveTo(40, y + 13).lineTo(555, y + 13).stroke("#dddddd");
      y += 20;
    };
    head();
    doc.fillColor("#000").fontSize(9);
    if (rows.length === 0) {
      doc.text(empty, 40, y);
      doc.y = y + 18;
      return;
    }
    for (const r of rows) {
      if (y > 790) {
        doc.addPage();
        y = 40;
        head();
        doc.fillColor("#000").fontSize(9);
      }
      r.forEach((cell, i) =>
        doc.text(cell, cols[i].x, y, { width: cols[i].width, align: cols[i].align ?? "left", lineBreak: false }),
      );
      y += 15;
    }
    doc.y = y;
  };

  drawTable(
    "Customers & Suppliers",
    [
      { label: "Name", x: 40, width: 150 },
      { label: "Type", x: 195, width: 70 },
      { label: "You Gave", x: 270, width: 80, align: "right" },
      { label: "You Got", x: 355, width: 80, align: "right" },
      { label: "Balance", x: 440, width: 115, align: "right" },
    ],
    s.parties.map((p) => {
      const d = describeBalance(p.balancePaise);
      return [clip(p.name, 28), p.type, num(p.gavePaise), num(p.gotPaise), `${num(d.amountPaise)} ${d.status}`];
    }),
    "No parties.",
  );

  drawTable(
    "Transactions (ledger)",
    [
      { label: "Date", x: 40, width: 65 },
      { label: "Party", x: 110, width: 135 },
      { label: "You Gave", x: 250, width: 80, align: "right" },
      { label: "You Got", x: 335, width: 80, align: "right" },
      { label: "Note", x: 420, width: 135 },
    ],
    s.transactions.map((t) => [
      date(t.date),
      clip(t.partyName, 26),
      t.type === "CREDIT" ? num(t.amountPaise) : "",
      t.type === "DEBIT" ? num(t.amountPaise) : "",
      clip(t.note ?? "", 28),
    ]),
    "No transactions in this period.",
  );

  drawTable(
    "Cashbook (cash in / out)",
    [
      { label: "Date", x: 40, width: 65 },
      { label: "Type", x: 110, width: 65 },
      { label: "Cash In", x: 180, width: 80, align: "right" },
      { label: "Cash Out", x: 265, width: 80, align: "right" },
      { label: "Mode", x: 350, width: 55 },
      { label: "Note", x: 410, width: 145 },
    ],
    s.cashbook.map((e) => [
      date(e.date),
      e.direction === "IN" ? "Cash In" : "Cash Out",
      e.direction === "IN" ? num(e.amountPaise) : "",
      e.direction === "OUT" ? num(e.amountPaise) : "",
      e.paymentMode ?? "",
      clip(e.note ?? "", 30),
    ]),
    "No cash entries in this period.",
  );

  doc.end();
}
