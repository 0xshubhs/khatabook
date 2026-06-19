import { prisma } from "@khatabook/database";
import { createTransactionSchema, updateTransactionSchema } from "@khatabook/shared";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";
import { getOwnedParty, getOwnedTransaction } from "../lib/tenant";

export const transactionsRouter = Router();

// POST /transactions { partyId, type, amountPaise, ... }
transactionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createTransactionSchema.parse(req.body);
    await getOwnedParty(req.userId!, data.partyId); // tenant check
    const txn = await prisma.transaction.create({
      data: {
        id: data.id,
        partyId: data.partyId,
        type: data.type,
        amountPaise: data.amountPaise,
        note: data.note,
        attachmentUrl: data.attachmentUrl,
        attachments: data.attachments ?? undefined,
        txnDate: data.txnDate,
        dueDate: data.dueDate,
      },
    });
    res.status(201).json(txn);
  }),
);

// PATCH /transactions/:id
transactionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedTransaction(req.userId!, req.params.id);
    const data = updateTransactionSchema.parse(req.body);
    const txn = await prisma.transaction.update({ where: { id: req.params.id }, data });
    res.json(txn);
  }),
);

// DELETE /transactions/:id (soft delete)
transactionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedTransaction(req.userId!, req.params.id);
    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
