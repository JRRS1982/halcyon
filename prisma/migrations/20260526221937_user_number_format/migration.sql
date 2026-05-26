-- Per-user number display format (thousands separator + decimals). Additive,
-- defaulted, so existing rows pick up the comma/no-decimals default.

ALTER TABLE "UserSettings"
  ADD COLUMN "numberFormat" TEXT NOT NULL DEFAULT 'COMMA_0';
