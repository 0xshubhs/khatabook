import { prisma } from "@khatabook/database";
import { computeInvoiceTotal, createInvoiceSchema } from "@khatabook/shared";
import { Router } from "express";
import { ApiError, asyncHandler } from "../middleware/error";
import { streamInvoicePdf } from "../lib/pdf";
import { getOwnedBusiness, getOwnedInvoice, getOwnedParty } from "../lib/tenant";

export const invoicesRouter = Router();

// POST /invoices { businessId, partyId?, items[], number? } -> created invoice
invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = (req.body as { businessId?: unknown }).businessId;
    if (typeof businessId !== "string") throw new ApiError(400, "businessId required");
    await getOwnedBusiness(req.userId!, businessId);

    const data = createInvoiceSchema.parse(req.body);
    if (data.partyId) await getOwnedParty(req.userId!, data.partyId);

    const totalPaise = computeInvoiceTotal(data.items);
    const number = data.number ?? `INV-${String((await prisma.invoice.count({ where: { businessId } })) + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        id: data.id,
        businessId,
        partyId: data.partyId ?? null,
        number,
        items: data.items,
        totalPaise,
      },
    });
    res.status(201).json(invoice);
  }),
);

// GET /invoices/:id/pdf
invoicesRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const invoice = await getOwnedInvoice(req.userId!, req.params.id);
    const business = await prisma.business.findUnique({ where: { id: invoice.businessId } });
    const party = invoice.partyId
      ? await prisma.party.findUnique({ where: { id: invoice.partyId } })
      : null;
    streamInvoicePdf(res, {
      businessName: business?.name ?? "",
      number: invoice.number,
      partyName: party?.name ?? null,
      createdAt: invoice.createdAt,
      items: invoice.items as { name: string; qty: number; ratePaise: number }[],
      totalPaise: invoice.totalPaise,
    });
  }),
);
