// @khatabook/database — exports a singleton Prisma client + all generated types.
// The backend imports this. The webapp must NOT (no Prisma in the browser).
import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
