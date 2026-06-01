import { execSync } from "node:child_process";

// Runs once before the integration suite: refuse to touch anything that isn't
// the test database, then apply migrations to it.
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("halcyon_test")) {
    throw new Error(
      `Integration tests must run against halcyon_test — refusing DATABASE_URL=${url}`,
    );
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
