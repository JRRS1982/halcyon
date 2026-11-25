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

// A second, same-day move between the same two accounts.
async function addPair(
  db: PrismaClient,
  from: { id: string; userId: string },
  to: { id: string },
  amount: number,
) {
  const row = (accountId: string, signed: number) =>
    db.transaction.create({
      data: {
        userId: from.userId,
        accountId,
        date: new Date("2026-10-20"),
        amount: signed,
        description: `Standing order ${signed}`,
      },
    });
  return { out: await row(from.id, -amount), into: await row(to.id, amount) };
}

// Pairs of distinct sizes, so each row has exactly one match and no pair
// carries a warning. Newest first on screen: the largest amount is the newest.
async function seedPairs(db: PrismaClient, count: number) {
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
  const rows = Array.from({ length: count }, (_, i) => ({
    userId: user.id,
    date: new Date(Date.UTC(2026, 8, 1 + i)),
    amount: 10 + i,
  }));
  await db.transaction.createMany({
    data: rows.flatMap((row) => [
      {
        ...row,
        accountId: current.id,
        amount: -row.amount,
        description: `Out ${row.amount}`,
      },
      { ...row, accountId: savings.id, description: `In ${row.amount}` },
    ]),
  });
}

// The page's Approve all keeps one name; its text says where it stands.
const approveAll = (page: import("@playwright/test").Page) =>
  page.getByRole("button", {
    name: "Approve all possible transfers on this page",
  });

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

  test("Approve all marks every pair and keeps it listed; a second click puts the rows back in pencil", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const { current, savings, out, into } = await seedPair(db);
    const second = await addPair(db, current, savings, 75);
    const outs = [out.id, second.out.id];
    const ins = [into.id, second.into.id];
    // Each row's transfer account, by row.
    const transfers = async () =>
      Object.fromEntries(
        (
          await db.transaction.findMany({
            where: { id: { in: [...outs, ...ins] } },
          })
        ).map((row) => [row.id, row.transferAccountId]),
      );
    const all = (outTo: string | null, inFrom: string | null) =>
      Object.fromEntries([
        ...outs.map((id) => [id, outTo]),
        ...ins.map((id) => [id, inFrom]),
      ]);
    const pairLines = page.getByRole("checkbox", { name: /^Select pair/ });

    // Uncategorised only: an approved pair no longer matches it.
    await page.goto("/transactions?pairs=1&uncat=1");
    await expect(pairLines).toHaveCount(2);

    await expect(approveAll(page)).toHaveText("Approve all 2");
    await withServerAction(page, () => approveAll(page).click());
    await expect.poll(transfers).toEqual(all(savings.id, current.id));
    await expect(page.getByText("2 pairs marked as transfers.")).toBeVisible();
    await expect(pairLines).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /^Approve transfer/, pressed: true }),
    ).toHaveCount(2);

    await expect(approveAll(page)).toHaveText("✓ All approved");
    await withServerAction(page, () => approveAll(page).click());
    await expect.poll(transfers).toEqual(all(null, null));
    await expect(approveAll(page)).toHaveText("Approve all 2");
    await expect(
      page.getByRole("button", { name: "Transfer to Rainy Day" }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Transfer from Everyday" }),
    ).toHaveCount(2);
  });

  // An approved pair leaves the Uncategorised filter, so the server's next
  // page one is the pairs that came after. They must wait.
  test("with more pairs than a page, Approve all holds the page; its second click withdraws that batch, and the next page brings the rest", async ({
    page,
    db,
  }) => {
    await signIn(page);
    await seedPairs(db, 27);
    const tagged = () =>
      db.transaction.count({ where: { transferAccountId: { not: null } } });
    const pairLines = page.getByRole("checkbox", { name: /^Select pair/ });

    await page.goto("/transactions?pairs=1&uncat=1");
    await expect(approveAll(page)).toHaveText("Approve all 25");

    await withServerAction(page, () => approveAll(page).click());
    await expect.poll(tagged).toBe(50);
    await expect(approveAll(page)).toHaveText("✓ All approved");
    await expect(pairLines).toHaveCount(25);
    await expect(page.getByText("This page · 25 of 27 pairs")).toBeVisible();

    await withServerAction(page, () => approveAll(page).click());
    await expect.poll(tagged).toBe(0);
    await expect(approveAll(page)).toHaveText("Approve all 25");

    await withServerAction(page, () => approveAll(page).click());
    await expect.poll(tagged).toBe(50);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(pairLines).toHaveCount(2);
    await expect(approveAll(page)).toHaveText("Approve all 2");
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

// Styling, so every engine runs it. Nothing is written.
test.describe("a possible transfer's suggestion", () => {
  test("is pencilled in each row: dashed and italic", async ({ page, db }) => {
    await signIn(page);
    await seedPair(db);

    await page.goto("/transactions?pairs=1");

    for (const name of ["Transfer to Rainy Day", "Transfer from Everyday"]) {
      const suggestion = page.getByRole("button", { name });
      await expect(suggestion).toHaveCSS("font-style", "italic");
      await expect(suggestion).toHaveCSS("border-top-style", "dashed");
    }
  });
});

// Focus, so every engine runs it: a button disabled while its click is saved
// drops keyboard focus on some engines, and the undo is then a tab-hunt away.
test.describe("approving a pair from the keyboard", () => {
  test("leaves focus on the button that was pressed", async ({ page, db }) => {
    await signIn(page);
    const { out } = await seedPair(db);

    await page.goto("/transactions?pairs=1");
    const approve = page.getByRole("button", { name: /^Approve transfer/ });
    await approve.focus();
    await withServerAction(page, () => page.keyboard.press("Enter"));

    await expect(approve).toHaveAttribute("aria-pressed", "true");
    await expect(approve).toBeFocused();
    // The write is done before the test ends, whatever the engine.
    await expect
      .poll(
        async () =>
          (await db.transaction.findUniqueOrThrow({ where: { id: out.id } }))
            .transferAccountId,
      )
      .not.toBeNull();
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
      await expect(page.getByText(text, { exact: true })).toBeInViewport();
    }
  });
});
