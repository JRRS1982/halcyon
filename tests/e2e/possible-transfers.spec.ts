// The ledger's "Possible transfers" filter: money out of one account and the
// same amount into another within a few days, shown as a pair so both sides
// can be dealt with together. Rows are seeded straight into the database; the
// import journey is covered elsewhere.
import type { PrismaClient } from "@prisma/client";
import { buildAccountData } from "@/lib/accounts/creation";
import {
  expect,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

async function seedPair(db: PrismaClient) {
  const user = await signedInUser(db);
  const account = (name: string) =>
    db.account.create({
      data: {
        userId: user.id,
        name,
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
  const current = await account("Everyday");
  const savings = await account("Rainy Day");
  const out = await db.transaction.create({
    data: {
      userId: user.id,
      accountId: current.id,
      date: new Date("2026-11-03"),
      amount: -200,
      description: "To Rainy Day",
    },
  });
  const into = await db.transaction.create({
    data: {
      userId: user.id,
      accountId: savings.id,
      date: new Date("2026-11-04"),
      amount: 200,
      description: "From Everyday",
      extra: { Type: "Faster payment" },
    },
  });
  return { current, savings, out, into };
}

const pairCheckbox = (page: import("@playwright/test").Page) =>
  page.getByRole("checkbox", { name: /Select pair Everyday → Rainy Day/ });

test.describe("possible transfers", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "journey runs on chromium only");
  });

  test("Mark as transfer points each side at the other account", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const { current, savings, out, into } = await seedPair(db);

    await page.goto("/transactions?pairs=1");
    await expect(
      page.getByText(/Everyday → Rainy Day · .*1 day apart/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove filter: Possible transfers" }),
    ).toBeVisible();

    await pairCheckbox(page).check();
    await expect(page.getByText("2 selected")).toBeVisible();
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Mark as transfer" }).click(),
    );

    await expect
      .poll(async () =>
        (
          await db.transaction.findMany({
            where: { id: { in: [out.id, into.id] } },
            orderBy: { amount: "asc" },
          })
        ).map((row) => row.transferAccountId),
      )
      .toEqual([savings.id, current.id]);
  });

  test("Not a transfer hides the pair, and Undo brings it back", async ({
    page,
    db,
  }) => {
    await signIn(page);
    await seedPair(db);

    await page.goto("/transactions?pairs=1");
    await pairCheckbox(page).check();
    await withServerAction(page, () =>
      page.getByRole("button", { name: "Not a transfer" }).click(),
    );
    await expect(pairCheckbox(page)).toHaveCount(0);
    await expect.poll(() => db.dismissedTransferPair.count()).toBe(1);

    await withServerAction(page, () =>
      page.getByRole("button", { name: "Undo", exact: true }).click(),
    );
    await expect.poll(() => db.dismissedTransferPair.count()).toBe(0);
    await expect(pairCheckbox(page)).toBeVisible();
  });
});

// Layout, so every engine runs it.
test.describe("possible transfers on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a pair's summary and both amounts fit, with no sideways scroll", async ({
    page,
    db,
  }) => {
    await signIn(page);
    await seedPair(db);

    await page.goto("/transactions?pairs=1");
    await expect(pairCheckbox(page)).toBeVisible();

    const scroller = page.locator("[data-ledger-scroller]");
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    for (const text of ["To Rainy Day", "From Everyday"]) {
      await expect(page.getByText(text)).toBeInViewport();
    }
  });
});
