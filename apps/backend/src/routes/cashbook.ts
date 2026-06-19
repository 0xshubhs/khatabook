import { prisma } from "@khatabook/database";
import { createCashbookEntrySchema, updateCashbookEntrySchema } from "@khatabook/shared";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";
import { getOwnedBusiness, getOwnedCashbookEntry } from "../lib/tenant";

export const cashbookRouter = Router();

// POST /cashbook { businessId, direction, amountPaise, ... }
cashbookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createCashbookEntrySchema.parse(req.body);
    await getOwnedBusiness(req.userId!, data.businessId); // tenant check
    const entry = await prisma.cashbookEntry.create({
      data: {
        id: data.id,
        businessId: data.businessId,
        direction: data.direction,
        amountPaise: data.amountPaise,
        category: data.category,
        paymentMode: data.paymentMode,
        note: data.note,
        attachmentUrl: data.attachmentUrl,
        attachments: data.attachments ?? undefined,
        entryDate: data.entryDate,
      },
    });
    res.status(201).json(entry);
  }),
);

// PATCH /cashbook/:id
cashbookRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedCashbookEntry(req.userId!, req.params.id);
    const data = updateCashbookEntrySchema.parse(req.body);
    const entry = await prisma.cashbookEntry.update({ where: { id: req.params.id }, data });
    res.json(entry);
  }),
);

// DELETE /cashbook/:id (soft delete)
cashbookRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedCashbookEntry(req.userId!, req.params.id);
    await prisma.cashbookEntry.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
