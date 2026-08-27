-- Real UK income tax replaces the blended-rate stub.
CREATE TYPE "TaxRegime" AS ENUM ('RUK', 'SCOTLAND');

ALTER TABLE "Plan" ADD COLUMN "taxRegime" "TaxRegime" NOT NULL DEFAULT 'RUK';
ALTER TABLE "Plan" ADD COLUMN "thresholdsInflationLinked" BOOLEAN NOT NULL DEFAULT true;

-- Dropped, not kept: the column alone buys no comparison against the old
-- projection, since reproducing that needs the old code path too. All it would
-- preserve is one user-typed percentage that defaults to 20.
ALTER TABLE "Plan" DROP COLUMN "blendedTaxRatePct";
