-- AlterTable
ALTER TABLE "CashbookEntry" ADD COLUMN     "attachments" JSONB;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "attachments" JSONB;
