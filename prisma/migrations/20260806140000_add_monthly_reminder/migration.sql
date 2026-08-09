-- The monthly reminder email: whether it sends, when, and the unsubscribe key.
--
-- Off by default, and deliberately not backfilled to true for existing rows.
-- This is the only thing the app does that reaches a user unprompted, so it is
-- opt-in; flipping it on for people who never asked would be sending marketing
-- without consent, whatever the DEFAULT says.
ALTER TABLE "UserSettings"
  ADD COLUMN "monthlyReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "monthlyReminderDay" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "monthlyReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "unsubscribeToken" TEXT;

-- The send day is offered as four choices in Settings and validated by zod at
-- the boundary. The constraint is here so a bad write from anywhere — a future
-- action, a script, psql — fails at the database rather than scheduling mail
-- for the 31st of February.
ALTER TABLE "UserSettings"
  ADD CONSTRAINT "UserSettings_monthlyReminderDay_check"
  CHECK ("monthlyReminderDay" IN (1, 8, 15, 22));

-- Unique because the token is the sole credential an unsubscribe link carries:
-- a collision would unsubscribe the wrong person. Not partial — Postgres treats
-- NULLs as distinct in a unique index, so the many rows that never enable the
-- reminder can all sit at NULL, and a plain index is what Prisma's @unique
-- models (a partial one would show as drift on every migrate diff).
CREATE UNIQUE INDEX "UserSettings_unsubscribeToken_key"
  ON "UserSettings" ("unsubscribeToken");
