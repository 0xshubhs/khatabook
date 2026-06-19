import { prisma } from "@khatabook/database";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from "@khatabook/shared";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";
import { getOwnedBusiness, getOwnedInventoryItem } from "../lib/tenant";

export const inventoryRouter = Router();

// POST /inventory { businessId, name, stockQty?, lowStockThreshold?, pricePaise? }
inventoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = (req.body as { businessId?: unknown }).businessId;
    if (typeof businessId !== "string") {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    await getOwnedBusiness(req.userId!, businessId);
    const data = createInventoryItemSchema.parse(req.body);
    const item = await prisma.inventoryItem.create({
      data: {
        id: data.id,
        businessId,
        name: data.name,
        stockQty: data.stockQty,
        lowStockThreshold: data.lowStockThreshold,
        pricePaise: data.pricePaise,
      },
    });
    res.status(201).json(item);
  }),
);

// PATCH /inventory/:id  (edit fields, or stock in/out via stockDelta)
inventoryRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await getOwnedInventoryItem(req.userId!, req.params.id);
    const data = updateInventoryItemSchema.parse(req.body);

    const { stockDelta, ...rest } = data;
    const nextQty =
      stockDelta !== undefined
        ? Math.max(0, current.stockQty + stockDelta)
        : rest.stockQty;

    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        name: rest.name,
        lowStockThreshold: rest.lowStockThreshold,
        pricePaise: rest.pricePaise,
        ...(nextQty !== undefined ? { stockQty: nextQty } : {}),
      },
    });
    res.json(item);
  }),
);

// DELETE /inventory/:id (soft delete)
inventoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedInventoryItem(req.userId!, req.params.id);
    await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
