import { type Page, test as base } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Custom Playwright fixtures that give each data-touching e2e test a clean
// database — setup (truncate before), execute (the test body), teardown
// (truncate after) — so tests can't pollute one another.
//
// Why TRUNCATE and not a transaction-per-test rollback: Playwright drives a
// separate Next.js server process with its own DB connection, so a transaction
// opened here can't wrap the server's writes. TRUNCATE between tests is the
// correct isolation primitive for HTTP-driven e2e (and faster than DELETE — it
// doesn't scan rows). The PrismaClient is worker-scoped, so the connection is
// opened once per worker and reused, not per test.

// Deliberately NOT process.env.DATABASE_URL: importing @prisma/client loads
// .env, whose DATABASE_URL is the *production* database, so reading it here
// would (correctly) trip the guard below. e2e always targets the local test DB,
// which is the same address in CI and locally; E2E_DATABASE_URL overrides it.
const TEST_DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://test:test@localhost:5432/halcyon_test";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "db"];

// Refuse to truncate anything that isn't the local test database, so a stray
// prod DATABASE_URL in the environment can never be wiped.
function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (
    !LOCAL_HOSTS.includes(parsed.hostname) ||
    !dbName.startsWith("halcyon_test")
  ) {
    throw new Error(
      `Refusing to reset non-test database: ${parsed.hostname}/${dbName}. e2e resets only target halcyon_test on a local host.`,
    );
  }
}

type WorkerFixtures = { db: PrismaClient };
type TestFixtures = { cleanDb: undefined };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One PrismaClient per worker, reused across every test, disconnected at the
  // end of the worker run.
  db: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures require the destructured first arg
    async ({}, use) => {
      assertTestDatabase(TEST_DB_URL);
      const adapter = new PrismaPg({ connectionString: TEST_DB_URL });
      const prisma = new PrismaClient({ adapter });
      await use(prisma);
      await prisma.$disconnect();
    },
    { scope: "worker" },
  ],

  // Auto fixture: clean slate before the test, no residue after it. Cascades
  // from User to every user-owned table (settings, accounts, categories,
  // transactions, periods, items).
  cleanDb: [
    async ({ db }, use) => {
      await db.$executeRawUnsafe('TRUNCATE "User" CASCADE');
      await use(undefined);
      await db.$executeRawUnsafe('TRUNCATE "User" CASCADE');
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

const KNOWN_USER = { email: "test@example.com", password: "password123" };

// Signs in as the mock Supabase user and waits for the post-login redirect.
// The app upserts the User/UserSettings profile rows on the first request.
//
// Sign-in now lands directly on POST_AUTH_LANDING rather than bouncing off the
// marketing page, so this waits for the dashboard.
export async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.fill("input[name='email']", KNOWN_USER.email);
  await page.fill("input[name='password']", KNOWN_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
