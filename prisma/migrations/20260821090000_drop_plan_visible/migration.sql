-- Plan is a core feature: the nav link is unconditional, so the per-user
-- visibility flag has no reader left.
ALTER TABLE "UserSettings" DROP COLUMN "planVisible";
