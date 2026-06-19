import { prisma } from "@khatabook/database";
import {
  computePartyBalance,
  computeRunningBalance,
  describeBalance,
  formatPaise,
  updatePartySchema,
} from "@khatabook/shared";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";
import { streamStatementPdf } from "../lib/pdf";
import { getOwnedParty } from "../lib/tenant";

export const partiesRouter = Router();

// PATCH /parties/:id
partiesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedParty(req.userId!, req.params.id);
    const data = updatePartySchema.parse(req.body);
    const party = await prisma.party.update({ where: { id: req.params.id }, data });
    res.json(party);
  }),
);

// DELETE /parties/:id (soft delete)
partiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedParty(req.userId!, req.params.id);
    await prisma.party.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

// GET /parties/:id/ledger -> entries (chronological) with per-entry running balance
partiesRouter.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const party = await getOwnedParty(req.userId!, req.params.id);
    const txns = await prisma.transaction.findMany({
      where: { partyId: party.id, deletedAt: null },
    });
    const rows = computeRunningBalance(txns);
    const balancePaise = computePartyBalance(txns);
    res.json({
      party: {
        id: party.id,
        name: party.name,
        phone: party.phone,
        type: party.type,
        businessId: party.businessId,
      },
      balancePaise,
      balance: describeBalance(balancePaise),
      entries: rows.map((r) => ({ ...r.txn, runningBalancePaise: r.balancePaise })),
    });
  }),
);

// GET /parties/:id/statement.pdf -> downloadable account statement
partiesRouter.get(
  "/:id/statement.pdf",
  asyncHandler(async (req, res) => {
    const party = await getOwnedParty(req.userId!, req.params.id);
    const entries = await prisma.transaction.findMany({
      where: { partyId: party.id, deletedAt: null },
    });
    streamStatementPdf(res, {
      partyName: party.name,
      partyPhone: party.phone,
      entries,
    });
  }),
);

// POST /parties/:id/remind -> stub reminder (log + write Reminder row)
partiesRouter.post(
  "/:id/remind",
  asyncHandler(async (req, res) => {
    const party = await getOwnedParty(req.userId!, req.params.id);
    const txns = await prisma.transaction.findMany({
      where: { partyId: party.id, deletedAt: null },
    });
    const balancePaise = computePartyBalance(txns);
    const message = `Hi ${party.name}, a balance of ${formatPaise(
      Math.abs(balancePaise),
    )} is due on your account. Please clear it at your earliest. — Sharma General Store`;

    console.log(`[remind] (stub) -> ${party.phone ?? "no phone"}: ${message}`);
    const reminder = await prisma.reminder.create({
      data: {
        businessId: party.businessId,
        partyId: party.id,
        channel: "STUB",
        message,
      },
    });
    res.json({ ok: true, reminder });
  }),
);
