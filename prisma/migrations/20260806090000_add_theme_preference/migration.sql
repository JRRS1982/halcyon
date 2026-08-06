-- Light / dark / follow-the-OS, per user.
--
-- Text rather than an enum, matching the other preference columns on this table
-- (currency, numberFormat); the allowed values are enforced by zod at the
-- boundary. SYSTEM is the default because it needs no decision from anyone: the
-- app writes no data-theme attribute and prefers-color-scheme decides, live.
ALTER TABLE "UserSettings"
  ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'SYSTEM';
