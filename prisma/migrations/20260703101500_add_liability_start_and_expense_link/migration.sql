-- AlterTable
ALTER TABLE "PlanLiability" ADD COLUMN "startAge" INTEGER;

-- AlterTable
ALTER TABLE "PlanExpense" ADD COLUMN "liabilityId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "PlanExpense_liabilityId_key" ON "PlanExpense"("liabilityId");

-- AddForeignKey
ALTER TABLE "PlanExpense" ADD CONSTRAINT "PlanExpense_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PlanLiability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
