-- CreateIndex
CREATE UNIQUE INDEX "PlanLiability_linkedAssetId_key" ON "PlanLiability"("linkedAssetId");

-- AddForeignKey
ALTER TABLE "PlanLiability" ADD CONSTRAINT "PlanLiability_linkedAssetId_fkey" FOREIGN KEY ("linkedAssetId") REFERENCES "PlanAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
