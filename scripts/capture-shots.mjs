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
const shots = [
  { path: "/dashboard", file: "dashboard.png" },
  { path: "/budget", file: "budget.png" },
  { path: "/balance", file: "balance.png" },
  { path: "/transactions", file: "transactions.png" },
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
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.financialPeriod.deleteMany({ where: { userId } });

  const now = new Date();
  const monthStart = (back) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));

  const current = await prisma.account.create({
    data: { userId, name: "Current Account" },
  });
  const joint = await prisma.account.create({
    data: { userId, name: "Joint Account" },
  });

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
      label: "Rent",
      type: "EXPENSE",
      category: "FIXED",
      budget: 1250,
      actual: () => 1250,
      splits: [{ day: 1, share: 1, desc: "Rent standing order" }],
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

    await prisma.financialItem.createMany({
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
          type: "ASSET",
          category: "CURRENT",
          label: "Current account",
          value: 2400 + age * 60,
          sortOrder: 0,
        },
        {
          type: "ASSET",
          category: "MEDIUM_TERM",
          label: "Stocks & shares ISA",
          value: 14500 + age * 520,
          sortOrder: 1,
        },
        {
          type: "ASSET",
          category: "LONG_TERM",
          label: "Workplace pension",
          value: 41000 + age * 900,
          sortOrder: 2,
        },
        {
          type: "ASSET",
          category: "PROPERTY",
          label: "Flat",
          value: 285000,
          sortOrder: 3,
        },
        {
          type: "LIABILITY",
          category: "CURRENT",
          label: "Credit card",
          value: 620,
          sortOrder: 4,
        },
        {
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 212000 - age * 780,
          sortOrder: 5,
        },
      ].map((item) => ({ ...item, periodId: period.id })),
    });
  }
};

const browser = await chromium.launch();

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
    await seed(user.id);
  }

  for (const shot of shots) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    // The Next dev-tools bubble is not part of the product.
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
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
