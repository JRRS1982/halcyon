import { chromium } from "@playwright/test";
// Capture the landing page's product screenshots from a LOCAL, SIGNED-IN app.
//
// These shots are the first thing a prospect sees, and they had drifted badly:
// a five-column budget sheet that no longer exists, a dashboard without its
// summary row, and the old pre-contrast-fix greys. The cause was the old
// version of this script, which required a `.auth/state.json` hand-made through
// an interactive browser session — a manual step nobody repeats, so the shots
// silently aged out. It now signs itself in and seeds its own demo data, so
// re-capturing is one command with no setup.
//
// Run it against the e2e stack, which is entirely local — no cloud Supabase, no
// real account, nothing that can touch production data:
//
//   make db-up                       # or: docker start halcyon-db-1
//   node e2e/_mock/supabase.mjs &    # mock auth on :54321
//   pnpm next dev -p 3100 &          # with the env below
//   node scripts/capture-shots.mjs
//
// The dev server needs the mock's values so the browser client talks to it:
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_anon_key_for_e2e
//   SUPABASE_SECRET_KEY=sb_secret_test_key_for_e2e
//   DATABASE_URL=postgresql://test:test@localhost:5432/halcyon_test
//
// Every value below can be overridden by an env var of the same name if you'd
// rather point it at a different local setup.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3100";
const EMAIL = process.env.CAPTURE_EMAIL ?? "test@example.com";
const PASSWORD = process.env.CAPTURE_PASSWORD ?? "password123";
const DB_URL =
  process.env.CAPTURE_DATABASE_URL ??
  "postgresql://test:test@localhost:5432/halcyon_test";

// The same guard the e2e fixtures use: this script deletes and rewrites a
// user's data, so it must never be pointed at anything but a local database.
const parsed = new URL(DB_URL);
if (
  !["localhost", "127.0.0.1", "db"].includes(parsed.hostname) ||
  !parsed.pathname.replace(/^\//, "").startsWith("halcyon")
) {
  throw new Error(`Refusing to seed a non-local database: ${DB_URL}`);
}

const MONTHS = 12;
// `ready` is a selector that must be on the page before the shutter goes: a
// chart recharts has not measured yet renders nothing at all, so the timer
// below can photograph an empty panel where the projection should be.
const shots = [
  { path: "/dashboard", file: "dashboard.png" },
  { path: "/budget", file: "budget.png" },
  { path: "/balance", file: "balance.png" },
  { path: "/transactions", file: "transactions.png" },
  // Taller than the rest on purpose. At 900 the frame ends mid-plot, so the
  // shot leads with the assumptions form and cuts the chart in half — the
  // projection is the thing worth showing. The panel sits between the verdict
  // and the chart and does not collapse, so the honest way to give the chart
  // its room is more room, not a hidden panel. 1075 lands in the gap between
  // the chart card and the Timeline below it: a slice through the timeline's
  // rows reads as a mistake, where a clean edge reads as a page continuing.
  { path: "/plan", file: "plan.png", ready: ".recharts-surface", height: 1075 },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DB_URL }),
});

// Twelve months that tell a story: income steady, spending drifting up, savings
// and pension compounding, mortgage shrinking. Flat or empty data makes for a
// dishonest screenshot — the charts need something to actually show.
//
// Transactions are on by default, and in that mode the budget and dashboard
// ignore the stored `actual` column entirely — every displayed actual is
// computed from transactions joined by categoryId. So each budget row links to
// a category, and each month's story is told through transactions that net to
// the row's actual; the stored column keeps the same figures as the fallback.
const seed = async (userId) => {
  // The plan goes first, and not only so a re-run starts from nothing: its
  // rows point at the accounts deleted below, and a plan left behind would
  // survive with every link nulled — a plan of orphans that tunePlan can no
  // longer find its way around.
  await prisma.plan.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.financialPeriod.deleteMany({ where: { userId } });

  const now = new Date();
  const monthStart = (back) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));

  // Every balance row rests on an account, because that is what a balance row
  // is now. latestReality (src/lib/plan/reality.ts) — which is what fills a
  // plan — reads the user's accounts, skips `kind: NONE`, and finds each one's
  // value through `accountId`; a row carrying none is invisible to it, and a
  // plan seeded from such rows comes out completely empty. Joint Account is
  // the deliberate exception: somewhere transactions come from, not something
  // owned, so it stays NONE and never becomes a plan row.
  const account = (data) =>
    prisma.account.create({ data: { userId, ...data } });

  const current = await account({
    name: "Current Account",
    kind: "ASSET",
    category: "CURRENT",
    wrapper: "CASH",
  });
  const isa = await account({
    name: "Stocks & shares ISA",
    kind: "ASSET",
    category: "MEDIUM_TERM",
    wrapper: "ISA",
    canImportTransactions: false,
  });
  const pension = await account({
    name: "Workplace pension",
    kind: "ASSET",
    category: "LONG_TERM",
    wrapper: "PENSION",
    canImportTransactions: false,
  });
  const flat = await account({
    name: "Flat",
    kind: "ASSET",
    category: "PROPERTY",
    wrapper: "PROPERTY",
    canImportTransactions: false,
  });
  const creditCard = await account({
    name: "Credit card",
    kind: "LIABILITY",
    category: "CURRENT",
  });
  // Property ↔ mortgage. A fact about the house rather than about one plan,
  // which is why it lives on the account (docs/features/accounts.md).
  const mortgage = await account({
    name: "Mortgage",
    kind: "LIABILITY",
    category: "LONG_TERM",
    canImportTransactions: false,
    linkedAccountId: flat.id,
  });
  const joint = await account({ name: "Joint Account" });

  // One row per budget line: the category it links to, the monthly figures,
  // and the transactions that make up each month's actual (`share`s sum to 1;
  // the last split absorbs rounding so the month nets exactly).
  const ROWS = [
    {
      label: "Salary",
      type: "INCOME",
      incomeCategory: "SALARY",
      budget: 3400,
      actual: () => 3400,
      splits: [{ day: 25, share: 1, desc: "Monthly salary" }],
    },
    {
      label: "Side income",
      type: "INCOME",
      incomeCategory: "OTHER",
      budget: 250,
      actual: (wobble) => wobble(250),
      splits: [{ day: 14, share: 1, desc: "Freelance invoice" }],
    },
    {
      // The housing line is the mortgage on the Flat below, not rent: the
      // balance sheet already says this person owns the place they live in,
      // and a plan showing both a mortgage and a rent bill spends the same
      // money twice. tunePlan links this row to that debt as its repayment.
      label: "Mortgage",
      type: "EXPENSE",
      category: "FIXED",
      budget: 1250,
      actual: () => 1250,
      splits: [{ day: 1, share: 1, desc: "Mortgage payment" }],
    },
    {
      label: "Utilities",
      type: "EXPENSE",
      category: "FIXED",
      budget: 180,
      actual: (wobble) => wobble(180),
      splits: [{ day: 4, share: 1, desc: "Energy direct debit" }],
    },
    {
      label: "Groceries",
      type: "EXPENSE",
      category: "VARIABLE",
      budget: 420,
      actual: (wobble, age) => wobble(420 + age * 4),
      account: joint,
      splits: [
        { day: 3, share: 0.28, desc: "Supermarket" },
        { day: 10, share: 0.22, desc: "Corner shop" },
        { day: 17, share: 0.3, desc: "Supermarket" },
        { day: 24, share: 0.2, desc: "Greengrocer" },
      ],
    },
    {
      label: "Transport",
      type: "EXPENSE",
      category: "VARIABLE",
      budget: 160,
      actual: (wobble) => wobble(160),
      splits: [
        { day: 2, share: 0.78, desc: "Rail season ticket" },
        { day: 19, share: 0.22, desc: "Taxi" },
      ],
    },
    {
      label: "Dining out",
      type: "EXPENSE",
      category: "DISCRETIONARY",
      budget: 200,
      actual: (wobble, age) => wobble(200 + age * 6),
      splits: [
        { day: 6, share: 0.35, desc: "Restaurant" },
        { day: 13, share: 0.25, desc: "Coffee shop" },
        { day: 27, share: 0.4, desc: "Takeaway" },
      ],
    },
    {
      label: "Subscriptions",
      type: "EXPENSE",
      category: "DISCRETIONARY",
      budget: 45,
      actual: () => 45,
      splits: [{ day: 8, share: 1, desc: "Streaming subscription" }],
    },
  ];

  const categories = {};
  for (const row of ROWS) {
    categories[row.label] = await prisma.category.create({
      data: {
        userId,
        label: row.label,
        type: row.type,
        category: row.category ?? null,
        incomeCategory: row.incomeCategory ?? null,
      },
    });
  }

  for (let i = MONTHS - 1; i >= 0; i--) {
    const start = monthStart(i);
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    );
    const age = MONTHS - 1 - i; // 0 = oldest

    const period = await prisma.financialPeriod.create({
      data: {
        userId,
        granularity: "MONTH",
        startDate: start,
        endDate: end,
        label: start.toISOString().slice(0, 7),
      },
    });

    const wobble = (n) => Math.round(n * (1 + ((age % 3) - 1) * 0.06));

    await prisma.budgetItem.createMany({
      data: ROWS.map((row, idx) => ({
        periodId: period.id,
        categoryId: categories[row.label].id,
        type: row.type,
        category: row.category ?? null,
        incomeCategory: row.incomeCategory ?? null,
        label: row.label,
        budget: row.budget,
        actual: row.actual(wobble, age),
        sortOrder: idx,
      })),
    });

    // The transactions behind this month's actuals. Amounts are stored signed
    // (spend negative, receipts positive); the current month's dates clamp to
    // today so the ledger never shows the future.
    const transactions = [];
    for (const row of ROWS) {
      const total = row.actual(wobble, age);
      const signed = row.type === "EXPENSE" ? -total : total;
      let allocated = 0;
      row.splits.forEach((split, k) => {
        const isLast = k === row.splits.length - 1;
        const amount = isLast
          ? Math.round((signed - allocated) * 100) / 100
          : Math.round(signed * split.share * 100) / 100;
        allocated += amount;
        const day = i === 0 ? Math.min(split.day, now.getUTCDate()) : split.day;
        transactions.push({
          userId,
          accountId: (row.account ?? current).id,
          categoryId: categories[row.label].id,
          date: new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day),
          ),
          amount,
          description: split.desc,
        });
      });
    }
    await prisma.transaction.createMany({ data: transactions });

    await prisma.balanceItem.createMany({
      data: [
        {
          account: current,
          type: "ASSET",
          category: "CURRENT",
          label: "Current account",
          value: 2400 + age * 60,
          sortOrder: 0,
        },
        {
          account: isa,
          type: "ASSET",
          category: "MEDIUM_TERM",
          label: "Stocks & shares ISA",
          value: 14500 + age * 520,
          sortOrder: 1,
        },
        {
          account: pension,
          type: "ASSET",
          category: "LONG_TERM",
          label: "Workplace pension",
          value: 41000 + age * 900,
          sortOrder: 2,
        },
        {
          account: flat,
          type: "ASSET",
          category: "PROPERTY",
          label: "Flat",
          value: 285000,
          sortOrder: 3,
        },
        {
          account: creditCard,
          type: "LIABILITY",
          category: "CURRENT",
          label: "Credit card",
          value: 620,
          sortOrder: 4,
        },
        {
          account: mortgage,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 212000 - age * 780,
          sortOrder: 5,
        },
      ].map(({ account: owner, ...item }) => ({
        ...item,
        periodId: period.id,
        accountId: owner.id,
      })),
    });
  }

  return {
    accounts: { current, isa, pension, flat, creditCard, mortgage },
    mortgageCategoryId: categories.Mortgage.id,
  };
};

// The plan is created through the form a user fills in, not with Prisma:
// creating a plan is a Sync against an empty one, so its rows fall out of the
// accounts and categories seeded above by exactly the path the product takes.
// Hand-seeding them would be a second copy of that logic, free to drift.
const createPlan = async (page) => {
  // A 38-year-old: old enough to have a pension and a mortgage worth plotting,
  // young enough that the projection has somewhere to go. Derived from the
  // current year so the story doesn't age along with the script.
  const dateOfBirth = `${new Date().getUTCFullYear() - 38}-06-15`;

  await page.goto(`${BASE}/plan`, { waitUntil: "networkidle" });

  const field = page.locator("input[type='date']");
  const submit = page.getByRole("button", { name: "Create my plan" });

  // The form is served before React wires it up, and the button unlocks only
  // once the date reaches component state — so a fill landing pre-hydration is
  // silently swallowed and the button never enables. Re-filling converges the
  // moment handlers exist (the race e2e/_helpers/fixtures.ts documents for
  // createPlanWithDob).
  const deadline = Date.now() + 30_000;
  while (!(await submit.isEnabled())) {
    if (Date.now() > deadline) throw new Error("the plan form never hydrated");
    await field.fill(dateOfBirth);
    await page.waitForTimeout(250);
  }

  await submit.click();
  // exact: true, because getByRole matches an accessible name by substring —
  // "Your plan" also matches this very form's "Start your plan" heading, which
  // resolves instantly and hands back a page whose plan does not exist yet.
  await page
    .getByRole("heading", { name: "Your plan", exact: true })
    .waitFor({ timeout: 60_000 });
};

// A Sync carries balances, not assumptions — a balance sheet records what a
// debt is worth, never what it costs — so every synced liability arrives at 0%
// with a £0 repayment and every asset on the plan's single default return.
// Photographed untouched, the landing page would advertise a mortgage that
// never shrinks and a current account compounding like a pension. These are
// the figures a user would type in next, chosen to match the balances above.
const tunePlan = async (userId, accounts, mortgageCategoryId) => {
  const plan = await prisma.plan.findFirstOrThrow({
    where: { userId, isPrimary: true, deletedAt: null },
  });
  const rowFor = (model, account) =>
    model.findFirstOrThrow({
      where: { planId: plan.id, accountId: account.id },
    });

  // Cash barely keeps up with inflation, a flat roughly tracks it, and only
  // the invested pots earn a real return — one blended 5% across all four
  // would turn £285,000 of bricks into £1.7m by age 75.
  const returns = [
    [accounts.current, 1.5],
    [accounts.isa, 5],
    [accounts.pension, 5.5],
    [accounts.flat, 3],
  ];
  for (const [owner, expectedReturnPct] of returns) {
    const asset = await rowFor(prisma.planAsset, owner);
    await prisma.planAsset.update({
      where: { id: asset.id },
      data: { expectedReturnPct },
    });
  }

  const flat = await rowFor(prisma.planAsset, accounts.flat);
  const mortgage = await rowFor(prisma.planLiability, accounts.mortgage);
  // £1,250/mo against ~£203,000 at 4.5% clears in the user's mid-fifties, and
  // £1,250 is exactly what the budget pays out — which is why that row is
  // linked below as this debt's repayment rather than counted a second time as
  // ordinary spending. linkedAssetId is set by hand because a Sync doesn't
  // derive it from Account.linkedAccountId: the two links still live side by
  // side (docs/features/accounts.md → "What P1 does not do").
  await prisma.planLiability.update({
    where: { id: mortgage.id },
    data: { interestPct: 4.5, monthlyRepayment: 1250, linkedAssetId: flat.id },
  });

  const creditCard = await rowFor(prisma.planLiability, accounts.creditCard);
  await prisma.planLiability.update({
    where: { id: creditCard.id },
    data: { interestPct: 21.9, monthlyRepayment: 120 },
  });

  const repayment = await prisma.planExpense.findFirstOrThrow({
    where: { planId: plan.id, categoryId: mortgageCategoryId },
  });
  await prisma.planExpense.update({
    where: { id: repayment.id },
    data: { liabilityId: mortgage.id },
  });

  // Gives the timeline something to say after retirement. The engine works the
  // proceeds out itself — the property's value that year, net of whatever is
  // left on the mortgage — so the stored amount is never read
  // (src/lib/plan/project.ts).
  await prisma.planEvent.create({
    data: {
      planId: plan.id,
      label: "Sell the flat",
      age: 75,
      direction: "INFLOW",
      amount: 0,
      kind: "PROPERTY_SALE",
      assetId: flat.id,
    },
  });
};

// Chromium renders <input type="date"> in its *UI* locale, which comes from
// the browser process's environment. Neither the context's `locale` nor
// --lang=en-GB changes it — both were tried; only this does. Without it the
// plan shot's date of birth reads 06/15/1988, a US format on a product that is
// sterling throughout, with UK tax bands and a state pension age.
const browser = await chromium.launch({
  env: {
    ...process.env,
    LANG: "en_GB.UTF-8",
    LANGUAGE: "en_GB:en",
    LC_ALL: "en_GB.UTF-8",
  },
});

// Light only by default. The app has two schemes, but the landing page is only
// ever seen signed out — so a dark shot would have to be served by
// prefers-color-scheme, and doing that without losing next/image's optimisation
// means shipping both files to every visitor. Not a trade worth making for
// illustrative imagery. `CAPTURE_SCHEMES=light,dark` still captures the dark
// set when you want it for design review.
const schemes = (process.env.CAPTURE_SCHEMES ?? "light").split(",");

for (const scheme of schemes) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    // Pairs with --lang above: this one covers Accept-Language and any
    // Intl formatting the page does itself.
    locale: "en-GB",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/sign-in`);
  await page.fill("input[name='email']", EMAIL);
  await page.fill("input[name='password']", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(transactions|dashboard)$/);

  if (scheme === schemes[0]) {
    // The signed-in user's row exists by now, so seed against it. Once is
    // enough — any later pass reuses the same data.
    const user = await prisma.user.findFirstOrThrow();
    const { accounts, mortgageCategoryId } = await seed(user.id);
    await createPlan(page);
    await tunePlan(user.id, accounts, mortgageCategoryId);
  }

  for (const shot of shots) {
    // Always set it, never only when `shot.height` is present: a bare `if`
    // would leave a taller frame in place for whatever shot came next.
    await page.setViewportSize({ width: 1440, height: shot.height ?? 900 });
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    // The Next dev-tools bubble is not part of the product.
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    if (shot.ready)
      await page.waitForSelector(shot.ready, { state: "visible" });
    await page.waitForTimeout(1200); // let the charts settle
    const name =
      scheme === "light" ? shot.file : shot.file.replace(".png", "-dark.png");
    await page.screenshot({ path: `public/marketing/${name}` });
    console.log(`captured ${name}`);
  }

  await context.close();
}

await browser.close();
await prisma.$disconnect();
