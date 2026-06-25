-- AlterTable
ALTER TABLE "PlanAsset" ADD COLUMN     "feePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "minAccessAge" INTEGER;
