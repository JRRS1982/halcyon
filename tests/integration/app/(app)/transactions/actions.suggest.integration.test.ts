import { TEST_USER_ID } from "@test/support/helpers";
import { suggestCategory } from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// The "write a line" box pre-fills the category the user filed this merchant
// under before. If it is wrong, the add form offers the wrong category.
describe("suggestCategory (integration)", () => {
  test("offers the category the same merchant was filed under last time", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const coffee = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Coffee",
      },
    });
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: account.id,
        date: new Date("2026-10-01"),
        amount: -3.2,
        description: "PRET A MANGER 2210",
        categoryId: coffee.id,
      },
    });

    expect(await suggestCategory({ description: "Pret a Manger" })).toEqual({
      categoryId: coffee.id,
    });
    expect(await suggestCategory({ description: "Somewhere new" })).toEqual({
      categoryId: null,
    });
  });
});
