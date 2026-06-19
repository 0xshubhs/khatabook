// zod schemas for API payloads (SPEC §7). The backend validates with these and
// the webapp reuses them for client-side validation — one contract, no drift.
// Create payloads accept an optional client-generated UUID `id` so offline-created
// records keep their identity once they reach the server (SPEC §6).
import { z } from "zod";
import { CASH_DIRECTIONS, PARTY_TYPES, TRANSACTION_TYPES } from "./types";

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number");

export const amountPaiseSchema = z.number().int().positive();
export const idSchema = z.string().uuid();

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const cashDirectionSchema = z.enum(CASH_DIRECTIONS);
export const partyTypeSchema = z.enum(PARTY_TYPES);
export const paymentModeSchema = z.enum(["CASH", "ONLINE"]);

// --- auth ---
export const requestOtpSchema = z.object({ phone: phoneSchema });
export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^[0-9]{6}$/, "OTP must be 6 digits"),
});
export const setPinSchema = z.object({
  pin: z.string().regex(/^[0-9]{4}$/, "PIN must be 4 digits"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  // empty string clears the email
  email: z.string().email().or(z.literal("")).optional(),
});

// --- business ---
export const createBusinessSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
});
export const updateBusinessSchema = z.object({ name: z.string().min(1) });

// --- party ---
export const partyAddressSchema = z.object({
  flat: z.string().optional(),
  area: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  shippingSameAsBilling: z.boolean().optional(),
});
export const openingBalanceTypeSchema = z.enum(["GAVE", "GOT"]);
export const createPartySchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  phone: phoneSchema.optional(),
  type: partyTypeSchema.default("CUSTOMER"),
  gstin: z.string().optional(),
  address: partyAddressSchema.optional(),
  // Optional starting balance -> recorded as an initial transaction.
  // GAVE = you gave (CREDIT, they owe you); GOT = you got (DEBIT, advance).
  openingBalancePaise: z.number().int().positive().optional(),
  openingBalanceType: openingBalanceTypeSchema.optional(),
});
export const updatePartySchema = createPartySchema
  .partial()
  .omit({ id: true, openingBalancePaise: true, openingBalanceType: true });

// --- transaction ---
export const createTransactionSchema = z.object({
  id: idSchema.optional(),
  partyId: idSchema,
  type: transactionTypeSchema,
  amountPaise: amountPaiseSchema,
  note: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  attachments: z.array(z.string().url()).optional(),
  txnDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});
export const updateTransactionSchema = createTransactionSchema
  .partial()
  .omit({ id: true, partyId: true });

// --- cashbook ---
export const createCashbookEntrySchema = z.object({
  id: idSchema.optional(),
  businessId: idSchema,
  direction: cashDirectionSchema,
  amountPaise: amountPaiseSchema,
  category: z.string().optional(),
  paymentMode: paymentModeSchema.optional(),
  note: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  attachments: z.array(z.string().url()).optional(),
  entryDate: z.coerce.date().optional(),
});
export const updateCashbookEntrySchema = createCashbookEntrySchema
  .partial()
  .omit({ id: true, businessId: true });

// --- invoice ---
export const invoiceItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive(),
  ratePaise: amountPaiseSchema,
});
export const createInvoiceSchema = z.object({
  id: idSchema.optional(),
  partyId: idSchema.optional(),
  number: z.string().min(1).optional(), // auto-generated server-side if omitted
  items: z.array(invoiceItemSchema).min(1),
});

// --- inventory ---
export const createInventoryItemSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  stockQty: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(0),
  pricePaise: z.number().int().nonnegative().default(0),
});
export const updateInventoryItemSchema = z
  .object({
    name: z.string().min(1),
    stockQty: z.number().int().nonnegative(),
    lowStockThreshold: z.number().int().nonnegative(),
    pricePaise: z.number().int().nonnegative(),
    // Stock in/out: positive adds, negative removes (applied to current qty).
    stockDelta: z.number().int(),
  })
  .partial();

// --- inferred input types ---
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateCashbookEntryInput = z.infer<typeof createCashbookEntrySchema>;
