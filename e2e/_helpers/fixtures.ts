import { type Page, test as base, expect } from "@playwright/test";
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
// Sign-in lands on POST_AUTH_LANDING (/transactions) rather than bouncing off
// the marketing page.
export async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.fill("input[name='email']", KNOWN_USER.email);
  await page.fill("input[name='password']", KNOWN_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/transactions$/);
}

/**
 * Loads a route in a brand-new tab, sharing the current session.
 *
 * For "does this survive a full load", which was previously page.reload() and
 * failed on firefox with NS_BINDING_ABORTED — Firefox's way of saying our
 * navigation was cancelled by a later one. After a commit-on-keyup the plan
 * page is not idle: its handler awaits the server action and then calls
 * router.refresh() (src/app/(app)/plan/usePlanProjection.ts), and under
 * `next dev` the route may still be compiling. Waiting for the refresh to land
 * first was not enough — reloading a page the app is still driving keeps losing
 * that race, and only on firefox, since chromium and webkit resolve the reload
 * regardless.
 *
 * A new tab sidesteps the argument entirely rather than trying to win it. It
 * proves exactly what the reload was there to prove — the server now renders
 * the committed value — with no navigation of its own to collide with. The
 * caller closes it.
 */
export async function openFresh(page: Page, path: string): Promise<Page> {
  const fresh = await page.context().newPage();
  await fresh.goto(path);
  return fresh;
}

/**
 * The signed-in user's profile row, once the app has actually written it.
 *
 * Nothing in signIn() creates this row: it appears as a side effect of the
 * first authenticated server render, where getCurrentUserSettings inserts
 * User + UserSettings (src/lib/settings/server.ts). waitForURL resolves on the
 * client-side navigation, which can win the race against that insert
 * committing — so a bare findFirstOrThrow() straight after signIn() throws
 * "No record was found" on a loaded runner, and passes everywhere else.
 *
 * Polling is the honest expression of what the test needs: the row exists
 * shortly, not instantly.
 */
export async function signedInUser(db: PrismaClient) {
  await expect
    .poll(() => db.user.count(), {
      message: "waiting for the app to create the User profile row",
    })
    .toBeGreaterThan(0);
  return await db.user.findFirstOrThrow();
}

/**
 * Removes the starter budget sheet a new account is provisioned with.
 *
 * Signing in seeds the current month with £0 rows from the default categories
 * (src/lib/onboarding/defaults.ts). For a spec that seeds its own months and
 * then asserts on a derived figure, that starter month is a real recorded month
 * the derivation includes — and it is the *latest* one, so anything reading the
 * most recent point (the dashboard KPIs) reads zeros instead of the fixture.
 *
 * Deleting the periods cascades to their items and leaves the categories and
 * accounts in place, so the spec owns the whole picture without pretending a
 * new account has no defaults.
 */
export async function clearStarterPeriods(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  await db.financialPeriod.deleteMany({ where: { userId } });
}

/**
 * Uploads a CSV to the import panel and waits for the mapping step to appear.
 *
 * Setting files on the input fires a DOM change event. If React has not
 * finished hydrating the page, no handler is attached yet and that event is
 * simply lost — the panel never opens and the test sits waiting for a mapping
 * UI that will never arrive, failing 30s later with no error anywhere. It is
 * load-dependent, so it shows up as the import specs going "flaky" on a busy
 * CI runner or a loaded laptop, and it reproduces on master.
 *
 * Re-setting the files fires a fresh change event against a now-hydrated tree,
 * so retrying converges immediately once handlers exist. Real users can't hit
 * this — nobody picks a file within a few hundred ms of load — so the fix
 * belongs in the harness rather than the product.
 */
export async function importCsv(
  page: Page,
  csv: string,
  // The batch is labelled with the file name in the undo picker, so a spec
  // asserting on that label needs to choose it.
  fileName = "statement.csv",
): Promise<void> {
  const file = {
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  };
  const mappingStep = page.locator("select").filter({
    has: page.locator("option", { hasText: "New account" }),
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator('input[type="file"]').setInputFiles(file);
    try {
      await mappingStep.waitFor({ state: "visible", timeout: 3000 });
      return;
    } catch {
      // Not hydrated yet — clear the selection so re-setting the same file
      // counts as a change, and try again.
      await page.locator('input[type="file"]').setInputFiles([]);
    }
  }

  throw new Error("Import panel never reached the mapping step");
}

// Journeys that need the transactions feature on.
//
// New accounts get it enabled by default, and the clean-DB fixture makes every
// test a new account — so this is usually just an assertion. It still performs
// the toggle-and-confirm when the setting is off, so a spec reads as "this
// journey needs transactions" rather than silently depending on the default,
// and keeps working if that default ever changes again.
export async function ensureTransactionsEnabled(page: Page): Promise<void> {
  await page.goto("/settings");
  const toggle = page.getByRole("checkbox", { name: "Transactions" });

  if (!(await toggle.isChecked())) {
    await toggle.check({ force: true });
    await page.getByRole("button", { name: "Confirm" }).click();
  }

  // Nav link appears once the setting is saved + revalidated.
  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible();
}
