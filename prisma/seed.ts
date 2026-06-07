import { type IncomeCategory, PrismaClient, UserStatus } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { monthRangeFor, previousMonth } from "../src/lib/budget/period";
import { netActual } from "../src/lib/transactions/actual";

// Seed local development with a fully loginable demo user plus eighteen months
// of coherent data, so the transactions list and every dashboard chart populate.
// Money flows like a real household: salary lands in the Current Account, a
// standing order funds the Joint Account (which pays the bills), and monthly
// contributions transfer to an ISA and SIPP — both legs of every transfer are
// seeded, so the budget Transfers section populates too.
//
// The split (see docs/AuthFlow.md): there is no local Supabase Auth — the only
// `auth.users` is the cloud project. So the demo *user* is created in cloud
// auth (idempotently) via the admin API, while all financial data is written to
// whatever `DATABASE_URL` points at. The guard below refuses to run unless that
// is a local database, so the cloud Postgres is never wiped or seeded.
//
// Run via `make db-seed` (container: local DATABASE_URL wins, .env supplies the
// Supabase URL + secret). Never `pnpm db:seed` on the host — that resolves
// DATABASE_URL to production and the guard will throw.

const DEMO_EMAIL = "demo@halcyon.local";
const DEMO_PASSWORD = "halcyon-demo";
const MONTHS = 18;
const LOCAL_DB_HOSTS = ["db", "localhost", "127.0.0.1"];

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// ─── Guards ─────────────────────────────────────────────────────────────────

function assertLocalDatabase(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot seed production database");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!LOCAL_DB_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL host "${host}" is not local (${LOCAL_DB_HOSTS.join(", ")}). Run via \`make db-seed\`, never \`pnpm db:seed\` on the host.`,
    );
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────

// Service-role client built inline (not imported from src/lib/supabase/admin,
// which pulls in the Next-only `server-only` shim that won't resolve under
// tsx). Targets the cloud Supabase project — the only auth instance.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set to create " +
        "the demo auth user. Uncomment SUPABASE_SECRET_KEY in .env.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Finds or creates the demo user in cloud Supabase auth and returns its uuid.
// Idempotent: re-running reuses the existing auth user rather than erroring.
async function seedAuthUser(): Promise<string> {
  const admin = adminClient();

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

// ─── Reference data ─────────────────────────────────────────────────────────

type SeedCategory = {
  key: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  expenseCategory?: "FIXED" | "VARIABLE" | "DISCRETIONARY";
  incomeCategory?: IncomeCategory;
  budget: number;
};

// Keyed plan for the month: each category's typical transactions (signed —
// expenses negative, income positive) repeated every month with a small
// per-month drift so trends look real without randomness.
const CATEGORY_PLAN: SeedCategory[] = [
  {
    key: "salary",
    label: "Salary",
    type: "INCOME",
    incomeCategory: "SALARY",
    budget: 3000,
  },
  {
    key: "rent",
    label: "Rent",
    type: "EXPENSE",
    expenseCategory: "FIXED",
    budget: 1200,
  },
  {
    key: "councilTax",
    label: "Council Tax",
    type: "EXPENSE",
    expenseCategory: "FIXED",
    budget: 180,
  },
  {
    key: "groceries",
    label: "Groceries",
    type: "EXPENSE",
    expenseCategory: "VARIABLE",
    budget: 450,
  },
  {
    key: "fuel",
    label: "Fuel",
    type: "EXPENSE",
    expenseCategory: "VARIABLE",
    budget: 130,
  },
  {
    key: "dining",
    label: "Dining Out",
    type: "EXPENSE",
    expenseCategory: "DISCRETIONARY",
    budget: 140,
  },
  {
    key: "entertainment",
    label: "Entertainment",
    type: "EXPENSE",
    expenseCategory: "DISCRETIONARY",
    budget: 90,
  },
];

async function seedCategories(userId: string) {
  return Promise.all(
    CATEGORY_PLAN.map((c, sortOrder) =>
      prisma.category.create({
        data: {
          userId,
          type: c.type,
          category: c.expenseCategory ?? null,
          incomeCategory: c.incomeCategory ?? null,
          label: c.label,
          sortOrder,
        },
      }),
    ),
  ).then(
    (rows) =>
      new Map(
        CATEGORY_PLAN.map((c, i) => {
          const row = rows[i];
          if (!row) throw new Error(`Missing created category for ${c.key}`);
          return [c.key, row] as const;
        }),
      ),
  );
}

// Salary lands in `current`; `joint` pays the household bills; `isa` and
// `sipp` only ever receive transfer legs (cash contributions, no holdings).
async function seedAccounts(userId: string) {
  const [current, joint, isa, sipp] = await Promise.all([
    prisma.account.create({
      data: { userId, name: "Current Account", type: "CHECKING" },
    }),
    prisma.account.create({
      data: { userId, name: "Joint Account", type: "JOINT" },
    }),
    prisma.account.create({ data: { userId, name: "ISA", type: "ISA" } }),
    prisma.account.create({ data: { userId, name: "SIPP", type: "PENSION" } }),
  ]);
  return { current, joint, isa, sipp };
}

type AccountKey = keyof Awaited<ReturnType<typeof seedAccounts>>;

// ─── Time window ──────────────────────────────────────────────────────────

// The MONTHS calendar months ending with the current one, oldest first.
function monthWindow(now: Date) {
  let oldest = monthRangeFor(now.getUTCFullYear(), now.getUTCMonth());
  const ranges = [oldest];
  for (let i = 1; i < MONTHS; i++) {
    const prev = previousMonth(oldest.startDate);
    oldest = monthRangeFor(prev.year, prev.month);
    ranges.unshift(oldest);
  }
  return ranges;
}

// ─── Transactions ─────────────────────────────────────────────────────────

// The per-category transactions for a single month. monthIndex (0 = oldest)
// drives a small deterministic drift so spending isn't identical every month.
// Household bills come out of the Joint Account (funded by a monthly transfer
// from Current); personal spend stays on the Current Account.
function transactionsForMonth(
  year: number,
  month: number,
  monthIndex: number,
): {
  categoryKey: string;
  accountKey: AccountKey;
  day: number;
  amount: number;
  description: string;
}[] {
  const drift = monthIndex * 5;
  return [
    {
      categoryKey: "salary",
      accountKey: "current",
      day: 25,
      amount: 3000,
      description: "Monthly salary",
    },
    {
      categoryKey: "rent",
      accountKey: "joint",
      day: 1,
      amount: -1200,
      description: "Rent",
    },
    {
      categoryKey: "councilTax",
      accountKey: "joint",
      day: 5,
      amount: -180,
      description: "Council tax",
    },
    {
      categoryKey: "groceries",
      accountKey: "joint",
      day: 3,
      amount: -(110 + drift),
      description: "Supermarket",
    },
    {
      categoryKey: "groceries",
      accountKey: "joint",
      day: 11,
      amount: -95,
      description: "Supermarket",
    },
    {
      categoryKey: "groceries",
      accountKey: "joint",
      day: 19,
      amount: -(130 + drift),
      description: "Supermarket",
    },
    {
      categoryKey: "groceries",
      accountKey: "joint",
      day: 27,
      amount: -85,
      description: "Corner shop",
    },
    {
      categoryKey: "fuel",
      accountKey: "current",
      day: 8,
      amount: -(60 + drift),
      description: "Petrol station",
    },
    {
      categoryKey: "fuel",
      accountKey: "current",
      day: 22,
      amount: -55,
      description: "Petrol station",
    },
    {
      categoryKey: "dining",
      accountKey: "current",
      day: 14,
      amount: -(75 + drift),
      description: "Restaurant",
    },
    {
      categoryKey: "dining",
      accountKey: "current",
      day: 28,
      amount: -48,
      description: "Takeaway",
    },
    {
      categoryKey: "entertainment",
      accountKey: "current",
      day: 17,
      amount: -(45 + drift),
      description: "Cinema",
    },
    {
      categoryKey: "entertainment",
      accountKey: "current",
      day: 6,
      amount: -30,
      description: "Streaming",
    },
  ];
}

// Monthly standing orders out of the Current Account, paid the day after
// salary. Each is seeded as TWO transaction rows — one leg per account, each
// tagged with the counterparty via transferAccountId (no categoryId), so they
// are off-budget and surface only in the budget Transfers section. The Joint
// transfer covers the bills above (max joint outgoings ≈ £1,970 at peak drift).
const TRANSFER_PLAN: { from: AccountKey; to: AccountKey; amount: number }[] = [
  { from: "current", to: "joint", amount: 2000 },
  { from: "current", to: "isa", amount: 200 },
  { from: "current", to: "sipp", amount: 150 },
];
const TRANSFER_DAY = 26;

// Creates every transaction across [from, to] for the given accounts/categories
// and returns them grouped by `YYYY-M` month key for later actual-derivation.
// Transfer legs are seeded alongside but kept OUT of the returned map — they
// are off-budget by design and must never feed a category actual.
async function seedTransactions(
  userId: string,
  opts: {
    from: Date;
    to: Date;
    accounts: Record<AccountKey, { id: string; name: string }>;
    categories: Map<string, { id: string }>;
  },
) {
  const window = monthWindow(opts.to).filter(
    (r) => r.startDate >= opts.from && r.startDate <= opts.to,
  );
  const byMonth = new Map<string, { categoryKey: string; amount: number }[]>();

  for (const [monthIndex, range] of window.entries()) {
    const year = range.startDate.getUTCFullYear();
    const month = range.startDate.getUTCMonth();
    const planned = transactionsForMonth(year, month, monthIndex);
    const monthKey = `${year}-${month}`;
    byMonth.set(
      monthKey,
      planned.map((p) => ({ categoryKey: p.categoryKey, amount: p.amount })),
    );

    await prisma.transaction.createMany({
      data: planned.map((p) => ({
        userId,
        accountId: opts.accounts[p.accountKey].id,
        categoryId: categoryIdFor(opts.categories, p.categoryKey),
        date: new Date(Date.UTC(year, month, p.day)),
        amount: p.amount,
        description: p.description,
      })),
    });

    const transferDate = new Date(Date.UTC(year, month, TRANSFER_DAY));
    await prisma.transaction.createMany({
      data: TRANSFER_PLAN.flatMap((t) => [
        {
          userId,
          accountId: opts.accounts[t.from].id,
          transferAccountId: opts.accounts[t.to].id,
          date: transferDate,
          amount: -t.amount,
          description: `Transfer to ${opts.accounts[t.to].name}`,
        },
        {
          userId,
          accountId: opts.accounts[t.to].id,
          transferAccountId: opts.accounts[t.from].id,
          date: transferDate,
          amount: t.amount,
          description: `Transfer from ${opts.accounts[t.from].name}`,
        },
      ]),
    });
  }
  return byMonth;
}

function categoryIdFor(
  categories: Map<string, { id: string }>,
  key: string,
): string {
  const cat = categories.get(key);
  if (!cat) throw new Error(`Unknown category key: ${key}`);
  return cat.id;
}

// ─── Periods + budget items (actuals derived from transactions) ─────────────

async function seedPeriods(userId: string, opts: { from: Date; to: Date }) {
  const window = monthWindow(opts.to).filter(
    (r) => r.startDate >= opts.from && r.startDate <= opts.to,
  );
  return Promise.all(
    window.map((range) =>
      prisma.financialPeriod.create({
        data: {
          userId,
          granularity: "MONTH",
          startDate: range.startDate,
          endDate: range.endDate,
          label: range.label,
        },
      }),
    ),
  );
}

async function seedFinancialItems(
  _userId: string,
  opts: {
    periods: { id: string; startDate: Date }[];
    categories: Map<string, { id: string }>;
    transactions: Map<string, { categoryKey: string; amount: number }[]>;
  },
) {
  for (const period of opts.periods) {
    const monthKey = `${period.startDate.getUTCFullYear()}-${period.startDate.getUTCMonth()}`;
    const monthTxns = opts.transactions.get(monthKey) ?? [];

    await Promise.all(
      CATEGORY_PLAN.map((plan, sortOrder) => {
        const amounts = monthTxns
          .filter((t) => t.categoryKey === plan.key)
          .map((t) => t.amount);
        const actual = netActual(amounts, plan.type);
        return prisma.financialItem.create({
          data: {
            periodId: period.id,
            categoryId: categoryIdFor(opts.categories, plan.key),
            type: plan.type,
            category: plan.expenseCategory ?? null,
            incomeCategory: plan.incomeCategory ?? null,
            label: plan.label,
            budget: plan.budget,
            actual,
            sortOrder,
          },
        });
      }),
    );
  }
}

// ─── Balance sheet snapshots (trending net worth) ───────────────────────────

async function seedBalanceItems(
  _userId: string,
  opts: { periods: { id: string }[] },
) {
  // ISA/SIPP step up by exactly the monthly contribution (cash in, no
  // simulated investment growth — the app models flows, not holdings).
  for (const [i, period] of opts.periods.entries()) {
    const rows = [
      {
        type: "ASSET" as const,
        category: "CURRENT" as const,
        label: "Current Account",
        value: 1800 + i * 80,
      },
      {
        type: "ASSET" as const,
        category: "CURRENT" as const,
        label: "Joint Account",
        value: 500 + i * 30,
      },
      {
        type: "ASSET" as const,
        category: "MEDIUM_TERM" as const,
        label: "ISA",
        value: 4000 + i * 200,
      },
      {
        type: "ASSET" as const,
        category: "LONG_TERM" as const,
        label: "SIPP",
        value: 20000 + i * 150,
      },
      {
        type: "LIABILITY" as const,
        category: "CURRENT" as const,
        label: "Credit Card",
        value: Math.max(0, 1500 - i * 150),
      },
    ];
    await Promise.all(
      rows.map((r, sortOrder) =>
        prisma.balanceItem.create({
          data: {
            periodId: period.id,
            type: r.type,
            category: r.category,
            label: r.label,
            value: r.value,
            sortOrder,
          },
        }),
      ),
    );
  }
}

// ─── Orchestration ──────────────────────────────────────────────────────────

const main = async () => {
  console.log("🌱 Seeding database...");
  assertLocalDatabase();

  const userId = await seedAuthUser();
  console.log(`👤 Demo auth user ready: ${DEMO_EMAIL} (${userId})`);

  // Wipe local app data and recreate the profile row for the demo user. The
  // cloud auth user is untouched; the uuid is reused so data lines up on login.
  await prisma.user.deleteMany({});
  await prisma.user.create({
    data: {
      id: userId,
      name: "Demo User",
      username: "demo",
      timezone: "Europe/London",
      status: UserStatus.ACTIVE,
      lastActiveAt: new Date(),
    },
  });
  await prisma.userSettings.create({
    data: {
      userId,
      currency: "GBP",
      transactionsEnabled: true,
      transfersEnabled: true,
    },
  });

  const now = new Date();
  const window = monthWindow(now);
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last) throw new Error("Month window is empty");
  const from = first.startDate;
  const to = last.startDate;

  const categories = await seedCategories(userId);
  const accounts = await seedAccounts(userId);
  const transactions = await seedTransactions(userId, {
    from,
    to,
    accounts,
    categories,
  });
  const periods = await seedPeriods(userId, { from, to });
  await seedFinancialItems(userId, { periods, categories, transactions });
  await seedBalanceItems(userId, { periods });

  const txnCount = await prisma.transaction.count({ where: { userId } });
  console.log(
    `✅ Seeded ${periods.length} months, ${categories.size} categories, ` +
      `${txnCount} transactions`,
  );
  console.log(`🔑 Log in at /sign-in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
};

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
