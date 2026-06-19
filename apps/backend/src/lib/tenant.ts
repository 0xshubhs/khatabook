// Tenant isolation (SPEC §3 Security): every lookup is scoped to the JWT user.
// Cross-tenant access returns 404 (don't reveal that the row exists).
import { prisma } from "@khatabook/database";
import { ApiError } from "../middleware/error";

export async function getOwnedBusiness(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
  });
  if (!business) throw new ApiError(404, "Business not found");
  return business;
}

export async function getOwnedParty(userId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, deletedAt: null, business: { userId } },
  });
  if (!party) throw new ApiError(404, "Party not found");
  return party;
}

export async function getOwnedTransaction(userId: string, txnId: string) {
  const txn = await prisma.transaction.findFirst({
    where: { id: txnId, deletedAt: null, party: { business: { userId } } },
  });
  if (!txn) throw new ApiError(404, "Transaction not found");
  return txn;
}

export async function getOwnedCashbookEntry(userId: string, entryId: string) {
  const entry = await prisma.cashbookEntry.findFirst({
    where: { id: entryId, deletedAt: null, business: { userId } },
  });
  if (!entry) throw new ApiError(404, "Cashbook entry not found");
  return entry;
}

export async function getOwnedInvoice(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null, business: { userId } },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  return invoice;
}

export async function getOwnedInventoryItem(userId: string, itemId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, deletedAt: null, business: { userId } },
  });
  if (!item) throw new ApiError(404, "Inventory item not found");
  return item;
}
