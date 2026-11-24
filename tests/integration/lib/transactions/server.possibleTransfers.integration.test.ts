import { TEST_USER_ID } from "@test/support/helpers";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { PAIRS_PER_PAGE } from "@/lib/transactions/pagination";
import { snapshotOf } from "@/lib/transactions/possibleTransfers";
import { getTransactionsPage } from "@/lib/transactions/server";

const OTHER_USER = "00000000-0000-0000-0000-0000000000bb";

const account = (name: string, userId = TEST_USER_ID) =>
  prisma.account.create({
    data: { userId, name, ...buildAccountData({ type: "CURRENT_ACCOUNT" }) },
  });

const tx = (
  accountId: string,
  date: string,
  amount: number,
  extra: { userId?: string; categoryId?: string; deletedAt?: Date } = {},
) =>
  prisma.transaction.create({
    data: {
      userId: extra.userId ?? TEST_USER_ID,
      accountId,
      date: new Date(date),
      amount,
      description: `${amount} on ${date}`,
      categoryId: extra.categoryId,
      deletedAt: extra.deletedAt,
    },
  });

const pairsPage = (query: Parameters<typeof getTransactionsPage>[1] = {}) =>
  getTransactionsPage(TEST_USER_ID, { possibleTransfers: true, ...query });

describe("possible transfers (integration)", () => {
  test("finds a move out of one account and into another, both rows in order", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const out = await tx(current.id, "2026-11-03", -200);
    const into = await tx(savings.id, "2026-11-04", 200);

    const page = await pairsPage();

    expect(page.total).toBe(1);
    expect(page.items.map((row) => row.id)).toEqual([out.id, into.id]);
    expect(page.pairs).toEqual([
      expect.objectContaining({
        outId: out.id,
        inId: into.id,
        amount: 200,
        daysApart: 1,
        outAccountName: "Current",
        inAccountName: "Savings",
        isHidden: false,
      }),
    ]);
  });

  test("ignores the same account, deleted rows, the wrong window and other users", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    await tx(current.id, "2026-11-01", -10);
    await tx(current.id, "2026-11-01", 10); // same account
    await tx(current.id, "2026-11-01", -20);
    await tx(savings.id, "2026-11-01", 20, { deletedAt: new Date() });
    await tx(current.id, "2026-11-01", -30);
    await tx(savings.id, "2026-11-05", 30); // four days apart
    await prisma.user.create({ data: { id: OTHER_USER } });
    const theirs = await account("Theirs", OTHER_USER);
    await tx(current.id, "2026-11-01", -40);
    await tx(theirs.id, "2026-11-01", 40, { userId: OTHER_USER });

    const page = await pairsPage();

    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  });

  test("an account filter still shows the other account's side", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    await tx(current.id, "2026-11-03", -200);
    const into = await tx(savings.id, "2026-11-03", 200);

    const page = await pairsPage({ accountId: current.id });

    expect(page.items.map((row) => row.id)).toContain(into.id);
  });

  test("uncategorised only keeps a pair while one row still needs dealing with", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const food = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Food",
      },
    });
    await tx(current.id, "2026-11-01", -50, { categoryId: food.id });
    await tx(savings.id, "2026-11-01", 50, { categoryId: food.id });
    await tx(current.id, "2026-11-02", -60, { categoryId: food.id });
    const open = await tx(savings.id, "2026-11-02", 60);

    const page = await pairsPage({ onlyUncategorized: true });

    expect(page.total).toBe(1);
    expect(page.pairs?.[0]?.inId).toBe(open.id);
  });

  test("pages by pair, newest first, never splitting one", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    for (let i = 0; i <= PAIRS_PER_PAGE; i++) {
      const day = `2026-01-${String(1 + i).padStart(2, "0")}`;
      await tx(current.id, day, -(100 + i));
      await tx(savings.id, day, 100 + i);
    }

    const first = await pairsPage();
    const second = await pairsPage({ offset: PAIRS_PER_PAGE });

    expect(first.total).toBe(PAIRS_PER_PAGE + 1);
    expect(first.items).toHaveLength(PAIRS_PER_PAGE * 2);
    expect(first.pairs?.[0]?.amount).toBe(100 + PAIRS_PER_PAGE);
    expect(second.items).toHaveLength(2);
    expect(second.pairs?.[0]?.amount).toBe(100);
  });

  test("a dismissed pair leaves the list and shows only among hidden pairs", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const out = await tx(current.id, "2026-11-03", -75);
    const into = await tx(savings.id, "2026-11-03", 75);
    const candidate = (row: typeof out) => ({
      id: row.id,
      date: "2026-11-03",
      amount: Number(row.amount),
      accountId: row.accountId,
      transferAccountId: null,
    });
    await prisma.dismissedTransferPair.create({
      data: {
        userId: TEST_USER_ID,
        ...snapshotOf(candidate(out), candidate(into)),
        firstDate: new Date("2026-11-03"),
        secondDate: new Date("2026-11-03"),
      },
    });

    expect((await pairsPage()).total).toBe(0);
    const hidden = await pairsPage({ showHiddenPairs: true });
    expect(hidden.pairs).toEqual([
      expect.objectContaining({ outId: out.id, isHidden: true }),
    ]);
  });

  test("the ordinary ledger carries no pairs", async () => {
    const page = await getTransactionsPage(TEST_USER_ID, {});
    expect(page.pairs).toBeNull();
  });
});
