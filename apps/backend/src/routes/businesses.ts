import { prisma } from "@khatabook/database";
import {
  computeCashbookNet,
  computePartyBalance,
  createBusinessSchema,
  createPartySchema,
  describeBalance,
  isLowStock,
  updateBusinessSchema,
} from "@khatabook/shared";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";
import { streamSummaryPdf } from "../lib/pdf";
import { getBusinessSummary, parseDateRange } from "../lib/reports";
import { getOwnedBusiness } from "../lib/tenant";
import { streamSummaryXlsx } from "../lib/xlsx";

export const businessesRouter = Router();

// GET /businesses
businessesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businesses = await prisma.business.findMany({
      where: { userId: req.userId!, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    res.json(businesses);
  }),
);

// POST /businesses
businessesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createBusinessSchema.parse(req.body);
    const business = await prisma.business.create({
      data: { id: data.id, name: data.name, userId: req.userId! },
    });
    res.status(201).json(business);
  }),
);

// PATCH /businesses/:id
businessesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const data = updateBusinessSchema.parse(req.body);
    const business = await prisma.business.update({ where: { id: req.params.id }, data });
    res.json(business);
  }),
);

// DELETE /businesses/:id (soft delete)
businessesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    await prisma.business.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

// GET /businesses/:id/parties -> parties with computed balances
businessesRouter.get(
  "/:id/parties",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const parties = await prisma.party.findMany({
      where: { businessId: req.params.id, deletedAt: null },
      include: { transactions: { where: { deletedAt: null } } },
      orderBy: { name: "asc" },
    });
    res.json(
      parties.map((p) => {
        const balancePaise = computePartyBalance(p.transactions);
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          type: p.type,
          balancePaise,
          balance: describeBalance(balancePaise),
        };
      }),
    );
  }),
);

// POST /businesses/:id/parties
businessesRouter.post(
  "/:id/parties",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const data = createPartySchema.parse(req.body);
    const party = await prisma.party.create({
      data: {
        id: data.id,
        name: data.name,
        phone: data.phone,
        type: data.type,
        gstin: data.gstin,
        address: data.address ?? undefined,
        businessId: req.params.id,
      },
    });
    // Optional opening balance becomes an initial transaction.
    if (data.openingBalancePaise && data.openingBalanceType) {
      await prisma.transaction.create({
        data: {
          partyId: party.id,
          type: data.openingBalanceType === "GAVE" ? "CREDIT" : "DEBIT",
          amountPaise: data.openingBalancePaise,
          note: "Opening balance",
        },
      });
    }
    res.status(201).json(party);
  }),
);

// GET /businesses/:id/cashbook ?from&to
businessesRouter.get(
  "/:id/cashbook",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const range = parseDateRange(req.query.from, req.query.to);
    const entries = await prisma.cashbookEntry.findMany({
      where: {
        businessId: req.params.id,
        deletedAt: null,
        ...(range ? { entryDate: range } : {}),
      },
      orderBy: { entryDate: "desc" },
    });
    res.json({ entries, netPaise: computeCashbookNet(entries) });
  }),
);

// GET /businesses/:id/inventory -> items with a lowStock flag
businessesRouter.get(
  "/:id/inventory",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const items = await prisma.inventoryItem.findMany({
      where: { businessId: req.params.id, deletedAt: null },
      orderBy: { name: "asc" },
    });
    res.json(items.map((item) => ({ ...item, lowStock: isLowStock(item) })));
  }),
);

// GET /businesses/:id/invoices ?from&to
businessesRouter.get(
  "/:id/invoices",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const range = parseDateRange(req.query.from, req.query.to);
    const invoices = await prisma.invoice.findMany({
      where: {
        businessId: req.params.id,
        deletedAt: null,
        ...(range ? { createdAt: range } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices);
  }),
);

// GET /businesses/:id/reports/summary ?from&to
businessesRouter.get(
  "/:id/reports/summary",
  asyncHandler(async (req, res) => {
    await getOwnedBusiness(req.userId!, req.params.id);
    const summary = await getBusinessSummary(
      req.params.id,
      parseDateRange(req.query.from, req.query.to),
    );
    res.json(summary);
  }),
);

// GET /businesses/:id/reports/summary.pdf ?from&to
businessesRouter.get(
  "/:id/reports/summary.pdf",
  asyncHandler(async (req, res) => {
    const business = await getOwnedBusiness(req.userId!, req.params.id);
    const summary = await getBusinessSummary(
      req.params.id,
      parseDateRange(req.query.from, req.query.to),
    );
    streamSummaryPdf(res, { businessName: business.name, summary });
  }),
);

// GET /businesses/:id/reports/summary.xlsx ?from&to
businessesRouter.get(
  "/:id/reports/summary.xlsx",
  asyncHandler(async (req, res) => {
    const business = await getOwnedBusiness(req.userId!, req.params.id);
    const summary = await getBusinessSummary(
      req.params.id,
      parseDateRange(req.query.from, req.query.to),
    );
    await streamSummaryXlsx(res, { businessName: business.name, summary });
  }),
);
