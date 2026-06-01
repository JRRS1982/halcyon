-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "hiddenCharts" TEXT[] DEFAULT ARRAY[]::TEXT[];
