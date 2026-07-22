-- CreateEnum
CREATE TYPE "PlanEventKind" AS ENUM ('MANUAL', 'PROPERTY_SALE');

-- AlterTable
ALTER TABLE "PlanEvent" ADD COLUMN     "assetId" UUID,
ADD COLUMN     "kind" "PlanEventKind" NOT NULL DEFAULT 'MANUAL';

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PlanAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
