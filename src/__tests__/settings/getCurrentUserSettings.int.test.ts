import { currentMonthRange } from "@/lib/budget/period";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  STARTER_BUDGET_CATEGORIES,
} from "@/lib/onboarding/defaults";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// beforeEach seeds the user; deleting it puts us back to a brand-new account,
// so the next read hits the lazy-create path (delete cascades to UserSettings).
async function asBrandNewUser(): Promise<void> {
  await prisma.user.delete({ where: { id: TEST_USER_ID } });
}

describe("getCurrentUserSettings lazy row creation (integration)", () => {
  it("is concurrency-safe: parallel first-time calls don't race the row insert", async () => {
    await asBrandNewUser();

    // Fire many concurrent first-time reads. A select-then-insert upsert races
    // here: several callers find no row, all INSERT, and all but one fail with
    // a P2002 unique-constraint violation. An atomic insert (ON CONFLICT DO
    // NOTHING) must let every caller resolve.
    //
    // These really are 20 calls despite the React `cache()` around the
    // function: cache() memoises within a request scope, and there is no such
    // scope outside a render — so here it passes straight through, which is
    // exactly the concurrency this test is about.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => getCurrentUserSettings()),
    );

    expect(results).toHaveLength(20);
    for (const r of results) expect(r.userId).toBe(TEST_USER_ID);
    expect(await prisma.user.count({ where: { id: TEST_USER_ID } })).toBe(1);
    expect(
      await prisma.userSettings.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  // The starter data has no per-user unique constraint to fall back on, so
  // `skipDuplicates` cannot save us the way it does for User/UserSettings.
  // Twenty concurrent first requests must still produce exactly one set —
  // otherwise a new user opens Settings to every category several times over.
  it("seeds the starter data exactly once under concurrency", async () => {
    await asBrandNewUser();

    await Promise.all(
      Array.from({ length: 20 }, () => getCurrentUserSettings()),
    );

    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(DEFAULT_CATEGORIES.length);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(DEFAULT_ACCOUNTS.length);
    expect(
      await prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  it("gives a new user the default categories, in list order and bucketed", async () => {
    await asBrandNewUser();
    await getCurrentUserSettings();

    const categories = await prisma.category.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { sortOrder: "asc" },
    });

    expect(categories.map((c) => c.label)).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.label),
    );
    expect(categories.map((c) => c.sortOrder)).toEqual(
      DEFAULT_CATEGORIES.map((_, i) => i),
    );
    for (const [i, row] of categories.entries()) {
      const expected = DEFAULT_CATEGORIES[i];
      if (!expected) throw new Error(`no expectation for index ${i}`);
      expect(row.type).toBe(expected.type);
      const bucket =
        expected.type === "EXPENSE" ? row.category : row.incomeCategory;
      expect(bucket).toBe(expected.bucket);
    }
  });

  it("gives a new user the default accounts, with no type set", async () => {
    await asBrandNewUser();
    await getCurrentUserSettings();

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });

    expect(accounts.map((a) => a.name).sort()).toEqual(
      [...DEFAULT_ACCOUNTS].sort(),
    );
    for (const a of accounts) expect(a.type).toBeNull();
  });

  // The point of the £0 rows: /budget opens as a sheet to fill in rather than
  // an empty page with an "add row" button.
  it("pre-fills the current month's budget with the starter rows at zero", async () => {
    await asBrandNewUser();
    await getCurrentUserSettings();

    const range = currentMonthRange();
    const period = await prisma.financialPeriod.findFirstOrThrow({
      where: { userId: TEST_USER_ID },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    expect(period.granularity).toBe("MONTH");
    expect(period.label).toBe(range.label);
    expect(period.items.map((i) => i.label)).toEqual(
      STARTER_BUDGET_CATEGORIES.map((c) => c.label),
    );
    for (const item of period.items) {
      expect(Number(item.budget)).toBe(0);
      // Linked to its Category, which is what lets the transactions feature
      // overlay a computed actual on the row later.
      expect(item.categoryId).not.toBeNull();
    }
  });

  it("links every starter row to the category of the same label", async () => {
    await asBrandNewUser();
    await getCurrentUserSettings();

    const items = await prisma.financialItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
      include: { linkedCategory: true },
    });

    expect(items).toHaveLength(STARTER_BUDGET_CATEGORIES.length);
    for (const item of items) {
      expect(item.linkedCategory?.label).toBe(item.label);
      expect(item.linkedCategory?.userId).toBe(TEST_USER_ID);
    }
  });

  it("leaves an existing user's data alone on later reads", async () => {
    await asBrandNewUser();
    await getCurrentUserSettings();

    await prisma.category.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.account.deleteMany({ where: { userId: TEST_USER_ID } });

    // A user who has cleared their lists must not have them re-seeded on the
    // next page load — provisioning is a first-request-ever concern.
    await getCurrentUserSettings();

    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });
});
