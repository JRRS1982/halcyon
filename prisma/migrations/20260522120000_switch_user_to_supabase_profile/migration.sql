-- Switch public."User" from a NextAuth-style table to a Supabase Auth profile row.
-- See docs/ADRs/ADR-002-SecurityArchitecture.md and docs/DataModels/DataModels.md.
--
-- All auth-managed concerns (email, password, email verification, failed-login
-- counters, account lockout, password rotation) move to auth.users (Supabase-
-- managed). What remains on public."User" is the app-owned profile keyed 1:1
-- to auth.users.id by uuid.

-- The cuid()-style ids on existing rows cannot be cast to uuid, and there are
-- no real users to preserve at this stage of the project.
TRUNCATE TABLE "User";

-- Drop the email unique index (column is going away).
DROP INDEX "User_email_key";

-- Drop columns now owned by Supabase Auth.
ALTER TABLE "User"
  DROP COLUMN "email",
  DROP COLUMN "emailVerified",
  DROP COLUMN "password",
  DROP COLUMN "lastLogin",
  DROP COLUMN "lastLoginIp",
  DROP COLUMN "failedLoginAttempts",
  DROP COLUMN "accountLockedAt",
  DROP COLUMN "passwordChangedAt";

-- Switch id from text (cuid) to uuid. The id will be set explicitly by the
-- handle_new_user trigger (see the next migration) to equal auth.users.id.
ALTER TABLE "User"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
