import { createItemForMonth, updateItem } from "@/app/(app)/budget/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The plan reads the budget through categories — reality.ts joins on
// categoryId — and createItemForMonth never wrote one. Only the starter rows
// seeded at signup carried the link, so every row a user added themselves was
// invisible to their forecast, however carefully it was filled in.
describe("a budget row reaches the plan", () => {
  it("when it is created with a name", async () => {
    await createItemForMonth({
      year: 2026,
      month: 2,
      type: "INCOME",
      section: "SALARY",
      label: "Salary",
    });

    const rows = await latestReality(TEST_USER_ID);
    expect(rows.map((r) => r.label)).toContain("Salary");
  });

  // The path that actually happens: the Add drawer creates the row blank and
  // the name is typed into the sheet afterwards.
  it("when it is added blank and named afterwards", async () => {
    const { item } = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "EXPENSE",
      section: "FIXED",
      label: "",
    });

    await updateItem({ itemId: item.id, label: "Rent", budget: 1200 });

    const rows = await latestReality(TEST_USER_ID);
    expect(rows.map((r) => r.label)).toContain("Rent");
  });

  it("reuses the category when a second month names the same row", async () => {
    const a = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "EXPENSE",
      section: "FIXED",
      label: "Rent",
    });
    const b = await createItemForMonth({
      year: 2026,
      month: 3,
      type: "EXPENSE",
      section: "FIXED",
      label: "Rent",
    });

    expect(a.item.categoryId).not.toBeNull();
    expect(b.item.categoryId).toBe(a.item.categoryId);
    expect(
      await prisma.category.count({
        where: { userId: TEST_USER_ID, label: "Rent", deletedAt: null },
      }),
    ).toBe(1);
  });

  // A transfer or repayment keys on an account. Giving it a categoryId would
  // double-count it: once on the account's flow, once here as an expense.
  it("but a transfer never gets a category", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });
    const { item } = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "TRANSFER",
      label: "Vanguard ISA",
      accountId: account.id,
      direction: "INFLOW",
    });

    expect(item.categoryId).toBeNull();
  });
});
