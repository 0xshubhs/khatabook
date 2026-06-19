import { prisma } from "@khatabook/database";
import { Router } from "express";
import { asyncHandler } from "../middleware/error";

export const syncRouter = Router();

interface Change {
  id?: unknown;
  updatedAt?: unknown;
  deletedAt?: unknown;
  [k: string]: unknown;
}

const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const asDate = (v: unknown): Date | null => (typeof v === "string" ? new Date(v) : null);

interface PushResult {
  applied: number;
  skipped: number;
}

/** Last-write-wins: apply only if the incoming updatedAt is newer than what we have. */
function isNewer(incoming: Date | null, existing: Date): boolean {
  return incoming != null && incoming.getTime() > existing.getTime();
}

// GET /sync/pull?since=<ISO> — everything for the user's businesses changed since `since`.
syncRouter.get(
  "/pull",
  asyncHandler(async (req, res) => {
    const since = asStr(req.query.since) ? new Date(asStr(req.query.since)!) : new Date(0);

    // All businesses the user owns (incl. soft-deleted, so tombstones propagate).
    const allBusinesses = await prisma.business.findMany({ where: { userId: req.userId! } });
    const bizIds = allBusinesses.map((b) => b.id);

    const [parties, transactions, cashbook] = await Promise.all([
      prisma.party.findMany({ where: { businessId: { in: bizIds }, updatedAt: { gt: since } } }),
      prisma.transaction.findMany({
        where: { party: { businessId: { in: bizIds } }, updatedAt: { gt: since } },
      }),
      prisma.cashbookEntry.findMany({
        where: { businessId: { in: bizIds }, updatedAt: { gt: since } },
      }),
    ]);

    res.json({
      serverTime: new Date().toISOString(),
      changes: {
        businesses: allBusinesses.filter((b) => b.updatedAt > since),
        parties,
        transactions,
        cashbook,
      },
    });
  }),
);

// POST /sync/push { changes: { parties?, transactions?, cashbook? } } — batch upsert (LWW).
syncRouter.post(
  "/push",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const changes = (req.body as { changes?: Record<string, Change[]> }).changes ?? {};
    const result: PushResult = { applied: 0, skipped: 0 };

    const ownsBusiness = async (businessId?: string) =>
      !!businessId &&
      (await prisma.business.count({ where: { id: businessId, userId } })) > 0;
    const ownsParty = async (partyId?: string) =>
      !!partyId &&
      (await prisma.party.count({ where: { id: partyId, business: { userId } } })) > 0;

    for (const c of changes.parties ?? []) {
      try {
        const id = asStr(c.id);
        const businessId = asStr(c.businessId);
        if (!id || !(await ownsBusiness(businessId))) {
          result.skipped++;
          continue;
        }
        const existing = await prisma.party.findUnique({ where: { id } });
        const data = {
          name: asStr(c.name) ?? "Unknown",
          phone: asStr(c.phone) ?? null,
          type: asStr(c.type) === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER",
          deletedAt: asDate(c.deletedAt),
        } as const;
        if (!existing) {
          await prisma.party.create({ data: { id, businessId: businessId!, ...data } });
          result.applied++;
        } else if (isNewer(asDate(c.updatedAt), existing.updatedAt)) {
          await prisma.party.update({ where: { id }, data });
          result.applied++;
        } else result.skipped++;
      } catch {
        result.skipped++;
      }
    }

    for (const c of changes.transactions ?? []) {
      try {
        const id = asStr(c.id);
        const partyId = asStr(c.partyId);
        if (!id || !(await ownsParty(partyId))) {
          result.skipped++;
          continue;
        }
        const existing = await prisma.transaction.findUnique({ where: { id } });
        const data = {
          type: asStr(c.type) === "DEBIT" ? "DEBIT" : "CREDIT",
          amountPaise: typeof c.amountPaise === "number" ? c.amountPaise : 0,
          note: asStr(c.note) ?? null,
          txnDate: asDate(c.txnDate) ?? new Date(),
          deletedAt: asDate(c.deletedAt),
        } as const;
        if (!existing) {
          await prisma.transaction.create({ data: { id, partyId: partyId!, ...data } });
          result.applied++;
        } else if (isNewer(asDate(c.updatedAt), existing.updatedAt)) {
          await prisma.transaction.update({ where: { id }, data });
          result.applied++;
        } else result.skipped++;
      } catch {
        result.skipped++;
      }
    }

    for (const c of changes.cashbook ?? []) {
      try {
        const id = asStr(c.id);
        const businessId = asStr(c.businessId);
        if (!id || !(await ownsBusiness(businessId))) {
          result.skipped++;
          continue;
        }
        const existing = await prisma.cashbookEntry.findUnique({ where: { id } });
        const data = {
          direction: asStr(c.direction) === "OUT" ? "OUT" : "IN",
          amountPaise: typeof c.amountPaise === "number" ? c.amountPaise : 0,
          category: asStr(c.category) ?? null,
          note: asStr(c.note) ?? null,
          entryDate: asDate(c.entryDate) ?? new Date(),
          deletedAt: asDate(c.deletedAt),
        } as const;
        if (!existing) {
          await prisma.cashbookEntry.create({ data: { id, businessId: businessId!, ...data } });
          result.applied++;
        } else if (isNewer(asDate(c.updatedAt), existing.updatedAt)) {
          await prisma.cashbookEntry.update({ where: { id }, data });
          result.applied++;
        } else result.skipped++;
      } catch {
        result.skipped++;
      }
    }

    res.json(result);
  }),
);
