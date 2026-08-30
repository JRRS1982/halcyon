import { PrismaPg } from "@prisma/adapter-pg";
import { type CategorySection, PrismaClient, UserStatus } from "@prisma/client";
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
// The data is deliberately *not* harmonious — it's scripted to look like a real
// life. Salary varies (overtime, a lean month, an annual bonus); energy bills
// swing with the seasons; and IRREGULAR_EVENTS scatters one-offs a real
// household hits — an MOT, the home-insurance renewal, a broken washing
// machine, a summer holiday, Christmas, a tax refund. Budgets stay fixed while
// actuals move, so the budget sheet shows genuine over/under variance. The
// invested pots rise and fall on a scripted market-return curve (with real
// drawdowns) rather than climbing a straight line. Everything is deterministic
// — no randomness — so re-seeds are identical and reviewable.
//
// The split (see docs/features/auth.md): there is no local Supabase Auth — the only
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
  section: CategorySection;
  budget: number;
};

// Keyed plan for the month: each category's budget target plus the transactions
// that feed its derived actual. Budgets are the *target* line; actuals come
// from the seeded transactions, so recurring bills, seasonal swings, and the
// irregular one-offs in IRREGULAR_EVENTS make budget-vs-actual vary like a real
// household's would — over-budget in an MOT or Christmas month, under in a quiet
// one. Everything is deterministic (no randomness): variation is scripted by
// calendar month or monthIndex so re-seeds are identical.
//
// Monthly budgets for costs that only land once or twice a year (Motoring,
// Insurance's home leg, Holidays, Gifts) are the *annualised* figure ÷ 12 — a
// sinking-fund target — so the sheet shows a small monthly budget the actual
// blows past when the bill actually arrives.
const CATEGORY_PLAN: SeedCategory[] = [
  {
    key: "salary",
    label: "Salary",
    type: "INCOME",
    section: "SALARY",
    budget: 4000,
  },
  {
    key: "sideIncome",
    label: "Side Income",
    type: "INCOME",
    section: "SIDE_INCOME",
    budget: 100,
  },
  {
    key: "otherIncome",
    label: "Other Income",
    type: "INCOME",
    section: "OTHER",
    budget: 0,
  },
  {
    key: "mortgage",
    label: "Mortgage",
    type: "EXPENSE",
    section: "FIXED",
    budget: 1250,
  },
  {
    key: "councilTax",
    label: "Council Tax",
    type: "EXPENSE",
    section: "FIXED",
    budget: 180,
  },
  {
    key: "utilities",
    label: "Utilities",
    type: "EXPENSE",
    section: "FIXED",
    budget: 240,
  },
  {
    key: "insurance",
    label: "Insurance",
    type: "EXPENSE",
    section: "FIXED",
    budget: 70,
  },
  {
    key: "groceries",
    label: "Groceries",
    type: "EXPENSE",
    section: "VARIABLE",
    budget: 450,
  },
  {
    key: "fuel",
    label: "Fuel",
    type: "EXPENSE",
    section: "VARIABLE",
    budget: 130,
  },
  {
    key: "motoring",
    label: "Motoring",
    type: "EXPENSE",
    section: "VARIABLE",
    budget: 120,
  },
  {
    key: "health",
    label: "Health",
    type: "EXPENSE",
    section: "VARIABLE",
    budget: 40,
  },
  {
    key: "home",
    label: "Home & Maintenance",
    type: "EXPENSE",
    section: "VARIABLE",
    budget: 80,
  },
  {
    key: "dining",
    label: "Dining Out",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    budget: 140,
  },
  {
    key: "entertainment",
    label: "Entertainment",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    budget: 90,
  },
  {
    key: "holidays",
    label: "Holidays",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    budget: 200,
  },
  {
    key: "gifts",
    label: "Gifts",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    budget: 60,
  },
];

async function seedCategories(userId: string) {
  return Promise.all(
    CATEGORY_PLAN.map((c, sortOrder) =>
      prisma.category.create({
        data: {
          userId,
          type: c.type,
          section: c.section,
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
    prisma.account.create({ data: { userId, name: "Current Account" } }),
    prisma.account.create({ data: { userId, name: "Joint Account" } }),
    prisma.account.create({ data: { userId, name: "ISA" } }),
    prisma.account.create({ data: { userId, name: "SIPP" } }),
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

type PlannedTxn = {
  categoryKey: string;
  accountKey: AccountKey;
  day: number;
  amount: number;
  description: string;
};

// Deterministic per-month spend jitter (no randomness) so variable spending
// oscillates month to month instead of tracking a smooth line. Indexed by
// monthIndex, wraps if the window is ever longer than the table.
const SPEND_JITTER = [
  0, 18, -12, 26, -20, 9, 31, -14, 6, 22, -25, 14, -6, 34, -11, 19, 3, -18,
];
function jitter(monthIndex: number): number {
  return SPEND_JITTER[monthIndex % SPEND_JITTER.length] ?? 0;
}

// Base £4,000 salary with scripted deltas: two overtime months and one lean
// month (statutory sick pay / unpaid leave). Keyed by monthIndex.
const SALARY_DELTAS: Record<number, number> = {
  3: 150,
  8: -700,
  12: 280,
  16: 120,
};
function salaryForMonth(monthIndex: number): number {
  return 4000 + (SALARY_DELTAS[monthIndex] ?? 0);
}

// Gas/electric by calendar month (0 = Jan): high in winter, low in summer.
const ENERGY_BY_MONTH = [165, 150, 120, 95, 80, 72, 70, 72, 85, 110, 140, 160];

// The per-category transactions for a single month. Recurring bills and
// personal spend, plus calendar-driven seasonal items (winter energy, the
// annual bonus in March, the summer holiday in August, Christmas and a birthday
// gift). One-off, non-seasonal costs (MOT, home insurance, a broken appliance)
// live in IRREGULAR_EVENTS and are merged in by seedTransactions. Household
// bills come out of the Joint Account (funded by a monthly transfer from
// Current); personal spend stays on the Current Account.
function transactionsForMonth(
  _year: number,
  month: number,
  monthIndex: number,
): PlannedTxn[] {
  const j = jitter(monthIndex);
  const txns: PlannedTxn[] = [
    {
      categoryKey: "salary",
      accountKey: "current",
      day: 25,
      amount: salaryForMonth(monthIndex),
      description: "Monthly salary",
    },
    {
      categoryKey: "mortgage",
      accountKey: "joint",
      day: 1,
      amount: -1250,
      description: "Mortgage",
    },
    {
      categoryKey: "councilTax",
      accountKey: "joint",
      day: 5,
      amount: -180,
      description: "Council tax",
    },
    {
      categoryKey: "utilities",
      accountKey: "joint",
      day: 3,
      amount: -(ENERGY_BY_MONTH[month] ?? 100),
      description: "Energy bill",
    },
    {
      categoryKey: "utilities",
      accountKey: "joint",
      day: 15,
      amount: -38,
      description: "Water",
    },
    {
      categoryKey: "utilities",
      accountKey: "joint",
      day: 18,
      amount: -42,
      description: "Broadband & phone",
    },
    {
      categoryKey: "insurance",
      accountKey: "joint",
      day: 6,
      amount: -22,
      description: "Life insurance",
    },
    {
      categoryKey: "groceries",
      accountKey: "joint",
      day: 3,
      amount: -(110 + j),
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
      amount: -(130 + j),
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
      amount: -(60 + j),
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
      amount: -(75 + j),
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
      amount: -(45 + j),
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

  // Seasonal, calendar-driven items. An 18-month window always spans every
  // calendar month at least once, so each of these is guaranteed to appear.
  if (month === 2) {
    txns.push({
      categoryKey: "salary",
      accountKey: "current",
      day: 25,
      amount: 3200,
      description: "Annual bonus",
    });
  }
  if (month === 7) {
    txns.push(
      {
        categoryKey: "holidays",
        accountKey: "current",
        day: 2,
        amount: -1250,
        description: "Summer holiday",
      },
      {
        categoryKey: "holidays",
        accountKey: "current",
        day: 12,
        amount: -480,
        description: "Holiday spending money",
      },
    );
  }
  if (month === 5) {
    txns.push({
      categoryKey: "gifts",
      accountKey: "current",
      day: 20,
      amount: -60,
      description: "Birthday gift",
    });
  }
  if (month === 11) {
    txns.push({
      categoryKey: "gifts",
      accountKey: "current",
      day: 15,
      amount: -450,
      description: "Christmas gifts",
    });
  }

  return txns;
}

// One-off, non-seasonal events keyed to a specific monthIndex (0 = oldest).
// This is where the "life happens" chaos lives: an MOT, an annual car-insurance
// renewal, the home-insurance premium, a broken washing machine, a tax refund.
// Annual costs recur roughly twelve months apart so they land once or twice
// across the 18-month window. Signed like any transaction (spend negative,
// income positive); merged into the month's plan by seedTransactions.
const IRREGULAR_EVENTS: (PlannedTxn & { monthIndex: number })[] = [
  // Motoring — MOT/service, annual insurance renewal, road tax, a repair.
  {
    monthIndex: 2,
    categoryKey: "motoring",
    accountKey: "current",
    day: 9,
    amount: -520,
    description: "Car insurance (annual)",
  },
  {
    monthIndex: 2,
    categoryKey: "motoring",
    accountKey: "current",
    day: 10,
    amount: -180,
    description: "Road tax",
  },
  {
    monthIndex: 4,
    categoryKey: "motoring",
    accountKey: "current",
    day: 16,
    amount: -285,
    description: "MOT & service",
  },
  {
    monthIndex: 9,
    categoryKey: "motoring",
    accountKey: "current",
    day: 7,
    amount: -140,
    description: "Car repair — brakes",
  },
  {
    monthIndex: 14,
    categoryKey: "motoring",
    accountKey: "current",
    day: 9,
    amount: -545,
    description: "Car insurance (annual)",
  },
  {
    monthIndex: 16,
    categoryKey: "motoring",
    accountKey: "current",
    day: 16,
    amount: -310,
    description: "MOT & service",
  },
  // Insurance — annual home buildings & contents (household → Joint Account).
  {
    monthIndex: 3,
    categoryKey: "insurance",
    accountKey: "joint",
    day: 12,
    amount: -238,
    description: "Home insurance (annual)",
  },
  {
    monthIndex: 15,
    categoryKey: "insurance",
    accountKey: "joint",
    day: 12,
    amount: -252,
    description: "Home insurance (annual)",
  },
  // Health — dentist, optician, vet.
  {
    monthIndex: 5,
    categoryKey: "health",
    accountKey: "current",
    day: 11,
    amount: -68,
    description: "Dentist check-up",
  },
  {
    monthIndex: 8,
    categoryKey: "health",
    accountKey: "current",
    day: 19,
    amount: -145,
    description: "Optician & glasses",
  },
  {
    monthIndex: 10,
    categoryKey: "health",
    accountKey: "current",
    day: 6,
    amount: -180,
    description: "Vet — annual jabs",
  },
  {
    monthIndex: 13,
    categoryKey: "health",
    accountKey: "current",
    day: 21,
    amount: -240,
    description: "Dentist — crown",
  },
  // Home & maintenance — furniture, boiler, a broken appliance, redecorating.
  {
    monthIndex: 1,
    categoryKey: "home",
    accountKey: "current",
    day: 8,
    amount: -320,
    description: "New sofa (deposit)",
  },
  {
    monthIndex: 6,
    categoryKey: "home",
    accountKey: "current",
    day: 14,
    amount: -95,
    description: "Boiler service",
  },
  {
    monthIndex: 11,
    categoryKey: "home",
    accountKey: "current",
    day: 4,
    amount: -389,
    description: "Washing machine replacement",
  },
  {
    monthIndex: 17,
    categoryKey: "home",
    accountKey: "current",
    day: 9,
    amount: -260,
    description: "Redecorating — materials",
  },
  // Holidays — a weekend break on top of the seasonal summer holiday.
  {
    monthIndex: 15,
    categoryKey: "holidays",
    accountKey: "current",
    day: 23,
    amount: -340,
    description: "Weekend break",
  },
  // Extra income — a tax refund, occasional freelance work, birthday money.
  {
    monthIndex: 2,
    categoryKey: "otherIncome",
    accountKey: "current",
    day: 18,
    amount: 100,
    description: "Birthday money",
  },
  {
    monthIndex: 5,
    categoryKey: "otherIncome",
    accountKey: "current",
    day: 9,
    amount: 640,
    description: "HMRC tax refund",
  },
  {
    monthIndex: 6,
    categoryKey: "sideIncome",
    accountKey: "current",
    day: 27,
    amount: 300,
    description: "Freelance project",
  },
  {
    monthIndex: 14,
    categoryKey: "sideIncome",
    accountKey: "current",
    day: 24,
    amount: 250,
    description: "Freelance project",
  },
];

function eventsForMonth(monthIndex: number): PlannedTxn[] {
  return IRREGULAR_EVENTS.filter((e) => e.monthIndex === monthIndex).map(
    ({ monthIndex: _monthIndex, ...txn }) => txn,
  );
}

// Monthly standing orders out of the Current Account, paid the day after
// salary. Each is seeded as TWO transaction rows — one leg per account, each
// tagged with the counterparty via transferAccountId (no categoryId), so they
// are off-budget and surface only in the budget Transfers section. The Joint
// transfer covers the household bills (mortgage £1,250 + council tax £180 +
// utilities up to ~£245 + life insurance £22 + groceries ~£490 ≈ £2,185, rising
// to ~£2,440 in a home-insurance month) — so £2,450 keeps the Joint Account in
// the black even in its heaviest month.
const TRANSFER_PLAN: { from: AccountKey; to: AccountKey; amount: number }[] = [
  { from: "current", to: "joint", amount: 2450 },
  { from: "current", to: "isa", amount: 350 },
  { from: "current", to: "sipp", amount: 400 },
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
    const planned = [
      ...transactionsForMonth(year, month, monthIndex),
      ...eventsForMonth(monthIndex),
    ];
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

async function seedBudgetItems(
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
        return prisma.budgetItem.create({
          data: {
            periodId: period.id,
            categoryId: categoryIdFor(opts.categories, plan.key),
            type: plan.type,
            section: plan.section,
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

// Scripted monthly market returns (decimals, no randomness) for the invested
// accounts, including two proper drawdowns (a ~3% wobble and a ~4.5% correction)
// so the ISA/SIPP — stocks & shares, not cash — rise and fall month to month
// while still trending up over the window. Indexed by monthIndex, wraps if the
// window ever outgrows the table.
const MARKET_RETURNS = [
  0.012, 0.008, -0.015, 0.021, 0.005, -0.032, 0.018, 0.024, -0.009, 0.011, 0.03,
  -0.045, 0.022, 0.016, 0.004, -0.011, 0.028, 0.019,
];
// Property drifts up gently with the odd flat or down month — nothing like the
// volatility of equities.
const PROPERTY_RETURNS = [
  0.004, 0.003, 0.005, 0.002, -0.002, 0.003, 0.004, 0.001, 0.005, 0.002, 0.003,
  -0.003, 0.004, 0.005, 0.002, 0.003, 0.001, 0.004,
];
// Everyday-account swings and the revolving credit-card balance — bounded, so
// liquid cash and the card breathe month to month instead of tracking a line.
const LIQUID_WOBBLE = [
  0, -180, 140, -260, 90, -120, 210, -90, 50, -200, 160, -300, 120, 80, -140,
  190, -60, -160,
];
const CARD_BALANCE = [
  520, 610, 480, 390, 560, 720, 430, 380, 650, 590, 470, 880, 540, 610, 700,
  460, 520, 830,
];

// Compounds `start` forward one month at a time, applying each period's return
// and then adding the monthly contribution — so an invested pot reflects both
// market movement and fresh cash. `volatility` scales the return series (a
// pension is steadier than a stocks & shares ISA). Returns one rounded value
// per period, oldest first.
function investedSeries(
  start: number,
  contribution: number,
  volatility: number,
  count: number,
): number[] {
  const series: number[] = [];
  let value = start;
  for (let i = 0; i < count; i++) {
    const monthlyReturn =
      (MARKET_RETURNS[i % MARKET_RETURNS.length] ?? 0) * volatility;
    value = value * (1 + monthlyReturn) + contribution;
    series.push(Math.round(value));
  }
  return series;
}

function propertySeries(start: number, count: number): number[] {
  const series: number[] = [];
  let value = start;
  for (let i = 0; i < count; i++) {
    value = value * (1 + (PROPERTY_RETURNS[i % PROPERTY_RETURNS.length] ?? 0));
    series.push(Math.round(value));
  }
  return series;
}

async function seedBalanceItems(
  _userId: string,
  opts: { periods: { id: string }[] },
) {
  // A realistic homeowner household (i = 0 is the oldest month, so the last
  // entry is "today" — what a freshly-created plan bootstraps from). The
  // invested pots (ISA/SIPP) compound a scripted market-return series on top of
  // their monthly contributions, so net worth genuinely rises and falls rather
  // than climbing a straight line. Property drifts up gently, the car
  // depreciates, and the mortgage is paid down. Everyday accounts wobble and the
  // credit card revolves (never zero), so it stays a meaningful liability.
  // These are independent monthly snapshots, not derived from the transactions.
  const count = opts.periods.length;
  const isaSeries = investedSeries(26000, 350, 1, count);
  const sippSeries = investedSeries(92000, 400, 0.8, count);
  const homeSeries = propertySeries(335000, count);

  for (const [i, period] of opts.periods.entries()) {
    const wobble = LIQUID_WOBBLE[i % LIQUID_WOBBLE.length] ?? 0;
    const jointWobble = LIQUID_WOBBLE[(i + 3) % LIQUID_WOBBLE.length] ?? 0;
    const rows = [
      {
        type: "ASSET" as const,
        category: "CURRENT" as const,
        label: "Current Account",
        value: 3500 + i * 30 + wobble,
      },
      {
        type: "ASSET" as const,
        category: "CURRENT" as const,
        label: "Joint Account",
        value: 9000 + i * 15 + jointWobble,
      },
      {
        type: "ASSET" as const,
        category: "MEDIUM_TERM" as const,
        label: "ISA",
        value: isaSeries[i] ?? 26000,
      },
      {
        type: "ASSET" as const,
        category: "LONG_TERM" as const,
        label: "SIPP",
        value: sippSeries[i] ?? 92000,
      },
      {
        type: "ASSET" as const,
        category: "PROPERTY" as const,
        label: "Home",
        value: homeSeries[i] ?? 335000,
      },
      {
        type: "ASSET" as const,
        category: "OTHER" as const,
        label: "Car",
        value: Math.max(8000, 14000 - i * 60),
      },
      {
        type: "LIABILITY" as const,
        category: "LONG_TERM" as const,
        label: "Mortgage",
        value: Math.max(0, 175000 - i * 250),
      },
      {
        type: "LIABILITY" as const,
        category: "CURRENT" as const,
        label: "Credit Card",
        value: CARD_BALANCE[i % CARD_BALANCE.length] ?? 450,
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
  await seedBudgetItems(userId, { periods, categories, transactions });
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
