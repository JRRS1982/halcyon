import type { AccountType } from "@prisma/client";
import { copyPeriodFrom, createItemForMonth } from "@/app/(app)/budget/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The copy paths write BudgetItem rows from ids they read out of other rows.
// Per ADR-002 the server Prisma role bypasses RLS, so the action's own userId
// filter is the only fence — a copy re-checks the anchor account rather than
// trusting it because the row it came from was owned. Accounts also drift:
// archived, deleted, or re-kinded after the source row was written.
//
// A row whose anchor no longer holds is skipped, never copied anchor-less: a
// TRANSFER with a null accountId is a row createItemForMonth could not produce
// (zod rejects it), renders with no target, and signs the month's surplus
// wrongly because a null direction reads as an inflow.

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const SOURCE = { year: 2026, month: 1 };
const TARGET = { year: 2026, month: 2 };

const createAccount = (userId: string, name: string, type: AccountType) =>
  prisma.account.create({
    data: { userId, name, ...buildAccountData({ type }) },
  });

const targetItems = (periodId: string) =>
  prisma.budgetItem.findMany({
    where: { periodId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });

const seedSourceTransfer = async () => {
  const isa = await createAccount(TEST_USER_ID, "Vanguard ISA", "STOCKS_ISA");
  const created = await createItemForMonth({
    ...SOURCE,
    type: "TRANSFER",
    label: "ISA saving",
    accountId: isa.id,
    direction: "OUTFLOW",
  });
  return { isa, ...created };
};

describe("copyPeriodFrom anchor handling (integration)", () => {
  test("carries accountId and direction onto the copied rows", async () => {
    const debt = await createAccount(TEST_USER_ID, "Mortgage", "MORTGAGE");
    const { isa, periodId: sourcePeriodId } = await seedSourceTransfer();
    await createItemForMonth({
      ...SOURCE,
      type: "REPAYMENT",
      label: "Mortgage",
      accountId: debt.id,
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(0);

    const rows = await targetItems(result.periodId);
    expect(rows).toHaveLength(2);

    const transfer = rows.find((r) => r.type === "TRANSFER");
    expect(transfer?.accountId).toBe(isa.id);
    expect(transfer?.direction).toBe("OUTFLOW");

    const repayment = rows.find((r) => r.type === "REPAYMENT");
    expect(repayment?.accountId).toBe(debt.id);
    expect(repayment?.direction).toBeNull();

    // The returned rows are what the sheet adopts without a refetch, so they
    // must carry the anchor too.
    expect(result.items.find((i) => i.type === "TRANSFER")).toMatchObject({
      accountId: isa.id,
      direction: "OUTFLOW",
    });
  });

  test("skips a row whose account was archived after it was written", async () => {
    const { isa, periodId: sourcePeriodId } = await seedSourceTransfer();
    await createItemForMonth({
      ...SOURCE,
      type: "EXPENSE",
      label: "Rent",
      section: "FIXED",
    });
    await prisma.account.update({
      where: { id: isa.id },
      data: { deletedAt: new Date() },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(1);

    const rows = await targetItems(result.periodId);
    expect(rows.map((r) => r.label)).toEqual(["Rent"]);
    expect(result.items.map((i) => i.label)).toEqual(["Rent"]);
  });

  test("skips a row whose account is no longer the right kind", async () => {
    const { isa, periodId: sourcePeriodId } = await seedSourceTransfer();
    await prisma.account.update({
      where: { id: isa.id },
      data: { kind: "LIABILITY" },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(1);
    expect(await targetItems(result.periodId)).toHaveLength(0);
  });

  test("skips a row pointing at another user's account", async () => {
    const { item, periodId: sourcePeriodId } = await seedSourceTransfer();

    const other = await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirIsa = await createAccount(other.id, "Their ISA", "STOCKS_ISA");
    // A live, correctly-kinded account — only ownership disqualifies it, so
    // this fails if the copy's account lookup drops its userId filter.
    await prisma.budgetItem.update({
      where: { id: item.id },
      data: { accountId: theirIsa.id },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(1);
    expect(await targetItems(result.periodId)).toHaveLength(0);
  });

  // Zod forbids an accountId on INCOME/EXPENSE, so a row carrying one arrived
  // some other way. It is still the user's budget line — cleaning the stray
  // anchor keeps the line and stops the id travelling on a row nothing checks;
  // dropping the line would lose data over a meaningless column.
  test("cleans a stray anchor off an unanchored kind instead of dropping it", async () => {
    const spending = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current account",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const { item, periodId: sourcePeriodId } = await createItemForMonth({
      ...SOURCE,
      type: "EXPENSE",
      label: "Rent",
      section: "FIXED",
    });
    await prisma.budgetItem.update({
      where: { id: item.id },
      data: { accountId: spending.id },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(0);

    const rows = await targetItems(result.periodId);
    expect(rows.map((r) => r.label)).toEqual(["Rent"]);
    expect(rows[0]?.accountId).toBeNull();
    expect(result.items[0]?.accountId).toBeNull();
  });

  // Same argument as the stray accountId above: anchorInvariants forbids a
  // direction on any kind but TRANSFER, so this row could not have been
  // created — but a REPAYMENT is valid without it, so clean rather than drop.
  test("cleans a stray direction off a repayment instead of dropping it", async () => {
    const debt = await createAccount(TEST_USER_ID, "Mortgage", "MORTGAGE");
    const { item, periodId: sourcePeriodId } = await createItemForMonth({
      ...SOURCE,
      type: "REPAYMENT",
      label: "Mortgage",
      accountId: debt.id,
    });
    await prisma.budgetItem.update({
      where: { id: item.id },
      data: { direction: "INFLOW" },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(0);

    const rows = await targetItems(result.periodId);
    expect(rows[0]?.accountId).toBe(debt.id);
    expect(rows[0]?.direction).toBeNull();
    expect(result.items[0]?.direction).toBeNull();
  });

  test("skips a TRANSFER left without a direction", async () => {
    const { item, periodId: sourcePeriodId } = await seedSourceTransfer();
    await prisma.budgetItem.update({
      where: { id: item.id },
      data: { direction: null },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.skipped).toBe(1);
    expect(await targetItems(result.periodId)).toHaveLength(0);
  });
});
