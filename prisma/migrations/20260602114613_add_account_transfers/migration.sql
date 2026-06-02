-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "transferAccountId" UUID;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "transfersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
