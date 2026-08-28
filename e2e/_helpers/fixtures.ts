import {
  test as base,
  expect,
  type Page,
  type Request,
} from "@playwright/test";
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

// "db" is the Compose service; "postgres" is the same idea in CI, where the
// e2e job runs inside the Playwright container and the database is a sibling
// container addressed by service name rather than over loopback.
//
// Widening this list does not weaken the guard that matters. Both conditions
// below must hold, and the database-name check is the one standing between a
// stray production URL and a TRUNCATE: prod is Supabase, whose database is
// named `postgres`, so it fails on the name no matter what host it arrives on.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "db", "postgres"];

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
 * Runs an interaction and waits for the writes it sets off to finish.
 *
 * The problem: these forms update optimistically, so the new value is on screen
 * before the server has been told. Navigate or reload at that point and the
 * browser cancels the request in flight (the dev server logs "destination
 * stream closed early"), so the next assertion reads a database that was never
 * written. `waitForLoadState("networkidle")` was standing in for this in twelve
 * places and cannot do the job: it can settle in a quiet window before the
 * request has even been issued.
 *
 * What counts as a write: a POST carrying Next's `next-action` header. That
 * separates real actions from the RSC refresh that follows one (a GET with
 * `rsc: 1`) and from the page's other traffic.
 *
 * Why "nothing in flight for a moment" and not "the response arrived": one
 * click can fire several actions in sequence, and a helper that waits for a
 * single response returns in the gap between them. That is what kept the
 * categorise test navigating away before its second write landed — since fixed
 * in the product, but adding a budget row still awaits ensurePeriodForMonth and
 * then createItem (BudgetSheet.tsx), so the shape is not going away and no
 * caller should have to know how many actions a button fires.
 */
export async function withServerAction<T>(
  page: Page,
  interact: () => Promise<T>,
): Promise<T> {
  let inFlight = 0;
  let lastChange = 0;

  // Only requests this call counted may decrement it. An action already in
  // flight when we attached — the previous step's, still finishing — would
  // otherwise fire `requestfinished` with no matching increment, leaving the
  // count at -1 and the wait unsatisfiable. That is browser-shaped rather than
  // random: the same action takes ~1.5s on chromium and ~3s on webkit, so the
  // overlap only shows up on the slower engines.
  const counted = new Set<Request>();
  let seen = 0;

  const started = (request: Request) => {
    if (request.method() !== "POST") return;
    if (request.headers()["next-action"] === undefined) return;
    counted.add(request);
    seen += 1;
    inFlight += 1;
    lastChange = Date.now();
  };
  const ended = (request: Request) => {
    if (!counted.delete(request)) return;
    inFlight -= 1;
    lastChange = Date.now();
  };

  page.on("request", started);
  page.on("requestfinished", ended);
  page.on("requestfailed", ended);

  // Did any action dispatch within `ms`? Resolves the moment one does, so the
  // happy path pays nothing.
  const sawAction = async (ms: number): Promise<boolean> => {
    try {
      await expect
        .poll(() => seen > 0, { timeout: ms, intervals: [50] })
        .toBe(true);
      return true;
    } catch {
      return false;
    }
  };

  try {
    let result = await interact();

    // A click can land on a server-rendered control before React has attached
    // its handler, and is then swallowed: no action dispatches, so there is
    // nothing to wait for and the settle below fails with "none ever started".
    // That is not engine-specific — the same race exists everywhere — but the
    // slower the engine the more often it loses: the comment above measures
    // the same action at ~1.5s on chromium and ~3s on webkit, and webkit under
    // CI load is where it actually bites.
    //
    // Retrying is safe *because* the listeners are attached before `interact`
    // runs: if `seen` is still 0, nothing was dispatched, so re-running cannot
    // double-write. That guarantee is what makes this generic — every caller
    // gets it without naming the effect its interaction was supposed to have.
    //
    // It follows that `interact` must be re-runnable when it did nothing.
    // Every current caller is a single click or select, which qualifies.
    let attempts = 1;
    while (attempts < 3 && !(await sawAction(1_000))) {
      attempts += 1;
      result = await interact();
    }

    // lastChange > 0 means at least one action was seen, so an interaction that
    // writes nothing fails here rather than passing on an empty quiet window.
    try {
      await expect
        .poll(
          () =>
            lastChange > 0 && inFlight === 0 && Date.now() - lastChange > 250,
          {
            // Not the default expect timeout (5s): under `next dev` the first
            // visit to a heavy route compiles it, and the plan actions
            // routinely take longer than that.
            timeout: 15_000,
          },
        )
        .toBe(true);
    } catch {
      // The poll's own message says only "expected true, got false", which
      // leaves you guessing between "nothing ever fired" and "something never
      // finished" — a distinction worth several runs of debugging.
      const sinceLastChange =
        lastChange === 0
          ? "none ever started"
          : `${Date.now() - lastChange}ms since one last changed state`;
      throw new Error(
        `Server actions did not settle — ${seen} started, ${inFlight} still in flight, ${sinceLastChange} (interaction attempted ${attempts}x)`,
      );
    }
    return result;
  } finally {
    page.off("request", started);
    page.off("requestfinished", ended);
    page.off("requestfailed", ended);
  }
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
 *
 * It waits for that starter sheet to exist first. Provisioning writes it in
 * one transaction on the first authenticated render, and signedInUser's poll
 * only proves the User row landed — so a delete issued too early removes
 * nothing at all, and the sheet then appears behind the spec's back.
 */
export async function clearStarterPeriods(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  await expect
    .poll(() => db.financialPeriod.count({ where: { userId } }), {
      message: "waiting for provisioning to seed the starter budget sheet",
    })
    .toBeGreaterThan(0);
  await db.financialPeriod.deleteMany({ where: { userId } });
}

/**
 * Gives the signed-in user the balance-sheet and budget rows a plan is built
 * from: a £100,000 pension account, and £4,000/mo of salary.
 *
 * A plan is populated by latestReality (src/lib/plan/reality.ts), which reads
 * the user's `Account`s and `Category`s and joins to observations through
 * `accountId` and `categoryId`. A `BalanceItem` carrying neither is invisible
 * to it, so a plan built from free-typed rows has no assets and no income at
 * all — not a plan missing a figure, an empty one. Everything seeded here is
 * therefore linked. No real user can create an unlinked row either: the
 * balance sheet rows on accounts.
 *
 * The asset needs an account of its own because every account provisioning
 * creates is `kind: NONE` — a plain transaction account, which latestReality
 * excludes by design. The income links to the "Salary" category provisioning
 * already made: it is already INCOME/SALARY, exactly what a plan income wants,
 * and a second category of the same name would only invite the wrong one.
 *
 * Both values are above zero on purpose — resolvePlanSync skips additions
 * worth nothing, so a £0 row silently produces no plan row.
 *
 * The starter budget sheet goes first, because it is a *more recent* period
 * than the one seeded here and "latest" is what reality means.
 */
export async function seedPlanReality(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  // First, and not only to clear the sheet: it waits for provisioning to
  // commit. Writing while that transaction is open deadlocks, because it locks
  // Account before FinancialPeriod and everything below does the opposite.
  await clearStarterPeriods(db, userId);

  const account = await db.account.create({
    data: {
      userId,
      name: "SIPP",
      kind: "ASSET",
      category: "LONG_TERM",
      // Stated on the account, not inferred from the label — a synced asset
      // takes the wrapper the user recorded, and PENSION is what the chart
      // legend reads back as "Pension".
      wrapper: "PENSION",
    },
  });

  const salary = await db.category.findFirstOrThrow({
    where: { userId, type: "INCOME", label: "Salary", deletedAt: null },
  });

  await db.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: new Date(Date.UTC(2026, 0, 31)),
      label: "Jan 2026",
      balanceItems: {
        create: [
          {
            accountId: account.id,
            type: "ASSET",
            category: "LONG_TERM",
            label: "SIPP",
            value: 100000,
          },
        ],
      },
      items: {
        create: [
          {
            categoryId: salary.id,
            type: "INCOME",
            incomeCategory: "SALARY",
            label: "Salary",
            budget: 4000,
          },
        ],
      },
    },
  });
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
/**
 * Creates a plan through the form, waiting for each of the three things that
 * have to be true in turn.
 *
 * "Create my plan" is `disabled={pending || !dob}` and the date field is
 * controlled with `value={dob}`, starting empty (CreatePlanForm.tsx) — so the
 * field's React onChange is the only thing that can enable the button, and a
 * fill() landing before hydration is discarded when React reconciles the
 * controlled value back to "".
 *
 * All three waits earn their place, which is worth stating because it was
 * measured the hard way. Eight sites did `waitForLoadState("networkidle")` then
 * filled and clicked, and replacing that settle with an explicit
 * fill-until-enabled retry took the plan suite from 0 failures to 12 — and to
 * 20 with the click left unbarriered. Every test still passed in isolation:
 * what broke was the *next* test, because a write still in flight when the
 * cleanDb fixture truncates leaks state across the boundary. So:
 *
 *  - the settle stays. It cannot *prove* hydration, but it does wait for the
 *    page to stop moving, and removing it is what caused the regression.
 *  - the retry is added on top, so the precondition the test depends on is
 *    stated rather than assumed, and a slow hydrate is survivable.
 *  - the click is barriered, so createPlan's write and revalidation have
 *    landed before the test proceeds or the fixture truncates. Seven of the
 *    eight sites had no barrier at all.
 */
export async function createPlanWithDob(
  page: Page,
  dob = "1986-06-01",
): Promise<void> {
  await page.waitForLoadState("networkidle");

  // Three fields in day-month-year order, not a native date input: that one
  // renders in the browser's locale, so its text and its calendar differ per
  // engine. `dob` stays YYYY-MM-DD, the form's own value shape.
  const [year, month, day] = dob.split("-");
  const create = page.getByRole("button", { name: /create my plan/i });

  await expect(async () => {
    await page.getByLabel("Day").fill(day ?? "");
    await page.getByLabel("Month").fill(month ?? "");
    await page.getByLabel("Year").fill(year ?? "");
    await expect(create).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  await withServerAction(page, () => create.click());
  // Widened for the same reason withServerAction is: under `next dev` the
  // first visit to /plan compiles it.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible({
    timeout: 15_000,
  });
}

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

/**
 * The balance sheet row whose name cell reads `name`.
 *
 * The sheet's editable cells (BalanceSheet.tsx's CellInput) are bare
 * `<input>`s with no associated label — their value is the row's name, not an
 * accessible name Playwright can query by role. React sets a freshly mounted
 * controlled input's value via the DOM `defaultValue` IDL property, which does
 * reflect the `value` content attribute, so a plain attribute selector finds a
 * row by the name it was created with.
 */
export function rowInput(page: Page, name: string) {
  return page.locator(`input[value="${name}"]`);
}

/**
 * Opens the balance sheet's "+ Add" drawer, re-clicking if the first click
 * didn't take.
 *
 * Mirrors mobile-nav.spec.ts's openMenu: a click landing before hydration is
 * swallowed by a button with no handler yet. Retrying while the drawer is
 * still closed converges once hydration catches up, without a fixed sleep.
 */
export async function openAddDrawer(page: Page): Promise<void> {
  const title = page.getByRole("heading", { name: "Add an account" });
  await expect(async () => {
    if (!(await title.isVisible())) {
      await page.getByRole("button", { name: "+ Add" }).click();
    }
    await expect(title).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Adds a plan asset through the Add drawer.
 *
 * The row is created on the drawer's Add, not on the toolbar button, so the
 * whole thing is one gesture: open, fill, confirm. The open is retried like
 * openAddDrawer's — the panel is server-rendered, so its button is clickable
 * before React attaches a handler.
 */
export async function addPlanAsset(
  page: Page,
  opts: {
    name: string;
    type?: string;
    value: string;
    mortgage?: "No mortgage" | "Add a new one" | "Link one I already have";
    /** Names the new mortgage, or picks the existing one, per `mortgage`. */
    mortgageLabel?: string;
  },
): Promise<void> {
  const panel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add asset" }) });
  const drawer = page.getByRole("dialog", { name: "Add an asset" });
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await panel.getByRole("button", { name: "+ Add asset" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await drawer.getByLabel("Name").fill(opts.name);
  if (opts.type) await drawer.getByLabel("Type").selectOption(opts.type);
  await drawer.getByLabel("Value today").fill(opts.value);
  if (opts.mortgage) {
    await drawer.getByRole("radio", { name: opts.mortgage }).check();
    if (opts.mortgage === "Add a new one" && opts.mortgageLabel) {
      await drawer.getByLabel("Mortgage name").fill(opts.mortgageLabel);
    }
    if (opts.mortgage === "Link one I already have" && opts.mortgageLabel) {
      await drawer
        .getByLabel("Which mortgage")
        .selectOption({ label: opts.mortgageLabel });
    }
  }
  await withServerAction(page, () =>
    drawer.getByRole("button", { name: "Add", exact: true }).click(),
  );
}

/** The mirror of addPlanAsset, for the Liabilities card. */
export async function addPlanLiability(
  page: Page,
  opts: {
    name: string;
    balance: string;
    mortgage?: boolean;
    property?: "Add a new one" | "Link one I already have";
    propertyLabel?: string;
  },
): Promise<void> {
  const panel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add liability" }) });
  const drawer = page.getByRole("dialog", { name: "Add a liability" });
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await panel.getByRole("button", { name: "+ Add liability" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await drawer.getByLabel("Name").fill(opts.name);
  await drawer.getByLabel("Balance owed today").fill(opts.balance);
  if (opts.mortgage) {
    await drawer
      .getByRole("checkbox", { name: "This is a mortgage on a property" })
      .check();
    if (opts.property) {
      await drawer.getByRole("radio", { name: opts.property }).check();
    }
    if (opts.property === "Add a new one" && opts.propertyLabel) {
      await drawer.getByLabel("Property name").fill(opts.propertyLabel);
    }
    if (opts.property === "Link one I already have" && opts.propertyLabel) {
      await drawer
        .getByLabel("Which property")
        .selectOption({ label: opts.propertyLabel });
    }
  }
  await withServerAction(page, () =>
    drawer.getByRole("button", { name: "Add", exact: true }).click(),
  );
}
