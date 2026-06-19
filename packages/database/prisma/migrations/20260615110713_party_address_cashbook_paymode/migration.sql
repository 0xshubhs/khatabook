-- AlterTable
ALTER TABLE "CashbookEntry" ADD COLUMN     "paymentMode" TEXT;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "address" JSONB,
ADD COLUMN     "gstin" TEXT;
