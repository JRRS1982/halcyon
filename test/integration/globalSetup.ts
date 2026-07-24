import { execSync } from "node:child_process";

// Runs once before the integration suite: refuse to touch anything that isn't
// the test database, then apply migrations to it.
export default async function globalSetup() {
  // The server actions under test import src/lib/env.ts (via prisma.ts and the
  // Supabase clients), which validates these at import. The Supabase auth
  // boundary is mocked in integration tests, so dummy values suffice — set
  // them only if absent so a caller-provided environment still wins.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://mock.supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??=
    "sb_publishable_int_test_dummy";
  process.env.SUPABASE_SECRET_KEY ??= "sb_secret_int_test_dummy";

  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("halcyon_test")) {
    throw new Error(
      `Integration tests must run against halcyon_test — refusing DATABASE_URL=${url}`,
    );
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
