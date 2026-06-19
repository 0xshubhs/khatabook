// Canonical domain enums, defined as literal arrays so both TS types and zod
// schemas derive from a single source. These mirror the Prisma enums (SPEC §4)
// by value — the webapp uses these (it can't import Prisma), the backend can use
// either since the string values are identical.

export const TRANSACTION_TYPES = ["CREDIT", "DEBIT"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const CASH_DIRECTIONS = ["IN", "OUT"] as const;
export type CashDirection = (typeof CASH_DIRECTIONS)[number];

export const PARTY_TYPES = ["CUSTOMER", "SUPPLIER"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];
