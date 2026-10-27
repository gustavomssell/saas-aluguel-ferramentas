-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('DELIVERY', 'RETURN');

-- CreateTable
CREATE TABLE "RentalInspection" (
    "id" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rentalId" TEXT NOT NULL,

    CONSTRAINT "RentalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalInspectionItem" (
    "id" TEXT NOT NULL,
    "quantityExpected" INTEGER NOT NULL,
    "quantityChecked" INTEGER NOT NULL,
    "damaged" INTEGER NOT NULL DEFAULT 0,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "inspectionId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "RentalInspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalInspection_rentalId_kind_idx" ON "RentalInspection"("rentalId", "kind");

-- CreateIndex
CREATE INDEX "RentalInspectionItem_inspectionId_idx" ON "RentalInspectionItem"("inspectionId");

-- AddForeignKey
ALTER TABLE "RentalInspection" ADD CONSTRAINT "RentalInspection_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalInspectionItem" ADD CONSTRAINT "RentalInspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "RentalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalInspectionItem" ADD CONSTRAINT "RentalInspectionItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
