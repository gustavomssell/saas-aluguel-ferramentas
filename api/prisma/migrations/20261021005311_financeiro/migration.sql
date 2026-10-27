-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('RENT', 'DEPOSIT', 'LATE_FEE', 'DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL DEFAULT 'RENT',
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rentalId" TEXT,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_orgId_status_dueDate_idx" ON "Charge"("orgId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Charge_rentalId_idx" ON "Charge"("rentalId");

-- CreateIndex
CREATE INDEX "Charge_orgId_customerId_idx" ON "Charge"("orgId", "customerId");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
