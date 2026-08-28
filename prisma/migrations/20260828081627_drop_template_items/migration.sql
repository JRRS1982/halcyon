-- The saved-template path is gone (#181): both sheets could snapshot a month
-- into a reusable template and offer it as a "★ Template" copy source, but
-- copying from a previous month already did that job. Nothing reads these two
-- tables any more.
--
-- Deliberately a separate migration from the code that stopped reading them.
-- Shipping both in one deploy is the split that broke /plan on 27 Aug 2026:
-- migrate-prod succeeded, the Vercel deploy failed, and production served old
-- code against a migrated schema until the next merge. Here that would be two
-- whole tables rather than one column.
--
-- Neither table is referenced by anything else — BalanceTemplateItem holds the
-- FKs (to User, to Account), so no ordering constraint between the drops.
DROP TABLE "BudgetTemplateItem";
DROP TABLE "BalanceTemplateItem";
