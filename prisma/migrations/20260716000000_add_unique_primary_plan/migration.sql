-- At most one primary, non-deleted plan per user. Backs the "one primary plan
-- per user (v1)" rule that createPlan's application-level guard cannot fully
-- guarantee under a concurrent race (two first-time calls can both pass the
-- findFirst check and both create).
--
-- Partial + soft-delete-aware: the predicate matches createPlan's own guard
-- (isPrimary = true AND deletedAt IS NULL), so soft-deleted plans are exempt.
-- Prisma's schema language can't express a filtered index, so it lives here as
-- raw SQL.
CREATE UNIQUE INDEX "Plan_userId_primary_unique"
  ON "Plan" ("userId")
  WHERE "isPrimary" AND "deletedAt" IS NULL;
