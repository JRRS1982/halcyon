import type { AccountType } from "@prisma/client";
import {
  createAccount,
  renameAccount,
  setAccountSection,
  setAccountType,
} from "@/app/(app)/balance/accountActions";
import {
  clearBalanceValue,
  copyBalancePeriodFrom,
  upsertBalanceValue,
} from "@/app/(app)/balance/actions";
import type { SerializedAccountRow } from "@/app/(app)/balance/BalanceSheet";
import BalancePage from "@/app/(app)/balance/page";
import { createItemForMonth } from "@/app/(app)/budget/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

// A typed account fixture — full data from buildAccountData, exactly the
// shape every real creation path writes (type/section).
function typedAccount(name: string, type: AccountType) {
  return prisma.account.create({
    data: { userId: TEST_USER_ID, name, ...buildAccountData({ type }) },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("setAccountType", () => {
  it("changes type within a kind, leaving section alone", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await setAccountType({ accountId: a.id, type: "STOCKS_ISA" });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(after.type).toBe("STOCKS_ISA");
    expect(after.section).toBe("MEDIUM_TERM"); // untouched — user's section stays
  });

  it("refuses a cross-kind change", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await expect(
      setAccountType({ accountId: a.id, type: "LOAN" }),
    ).rejects.toThrow(/asset and liability/);
  });

  it("refuses while linked, naming the link", async () => {
    const property = await typedAccount("Home", "PROPERTY");
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
        linkedAccountId: property.id,
      },
    });

    await expect(
      setAccountType({ accountId: property.id, type: "OTHER_ASSET" }),
    ).rejects.toThrow(/linked/);
    await expect(
      setAccountType({ accountId: mortgage.id, type: "LOAN" }),
    ).rejects.toThrow(/linked/);
  });

  it("refuses leaving PROPERTY with a sale event, naming it", async () => {
    const property = await typedAccount("Home", "PROPERTY");
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        isPrimary: true,
      },
    });
    const planAsset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 300000,
        accountId: property.id,
      },
    });
    await prisma.planEvent.create({
      data: {
        planId: plan.id,
        label: "Downsize",
        age: 70,
        direction: "INFLOW",
        kind: "PROPERTY_SALE",
        assetId: planAsset.id,
      },
    });

    await expect(
      setAccountType({ accountId: property.id, type: "OTHER_ASSET" }),
    ).rejects.toThrow(/sale event/);
  });

  it("allows moving TO property with no blocker, leaving section alone", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await setAccountType({ accountId: a.id, type: "PROPERTY" });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(after.type).toBe("PROPERTY");
    expect(after.section).toBe("MEDIUM_TERM");
  });
});

describe("upsertBalanceValue", () => {
  it("creates then updates — never duplicates", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 100,
    });
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 250,
    });
    const rows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, deletedAt: null },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.value)).toBe(250);
    expect(rows[0]?.carriedOver).toBe(false);
  });
});

describe("copyBalancePeriodFrom", () => {
  it("copying into a month that already has a value replaces it and marks carriedOver", async () => {
    const a = await typedAccount("Pot", "SAVINGS");

    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 0,
      value: 100,
    });
    const source = await prisma.financialPeriod.findFirstOrThrow({
      where: {
        userId: TEST_USER_ID,
        startDate: monthRangeFor(2026, 0).startDate,
      },
    });

    // The target month already has a live, user-confirmed value — copying
    // must replace it, not sit alongside it.
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 1,
      value: 999,
    });

    const result = await copyBalancePeriodFrom({
      sourcePeriodId: source.id,
      targetYear: 2026,
      targetMonth: 1,
    });

    const liveRows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, periodId: result.periodId, deletedAt: null },
    });
    expect(liveRows).toHaveLength(1);
    expect(Number(liveRows[0]?.value)).toBe(100);
    expect(liveRows[0]?.carriedOver).toBe(true);

    // The old value is soft-deleted, not left live alongside the new one —
    // the partial unique index on live (periodId, accountId) rows would
    // reject two live rows for the same account+month.
    const allTargetRows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, periodId: result.periodId },
    });
    expect(allTargetRows).toHaveLength(2);
    expect(allTargetRows.filter((r) => r.deletedAt !== null)).toHaveLength(1);
  });
});

describe("renameAccount", () => {
  it("renames the account and every live budget row anchored to it", async () => {
    const a = await typedAccount("Old ISA", "STOCKS_ISA");
    await createItemForMonth({
      year: 2026,
      month: 2,
      type: "TRANSFER",
      label: "Old ISA",
      accountId: a.id,
      direction: "INFLOW",
    });
    await renameAccount({ accountId: a.id, name: "New ISA" });
    const row = await prisma.budgetItem.findFirstOrThrow({
      where: { accountId: a.id },
    });
    expect(row.label).toBe("New ISA");
  });
});

describe("createAccount", () => {
  const baseInput = {
    year: 2026,
    month: 2,
    canImportTransactions: true,
    mortgage: null,
  } as const;

  it("assigns sortOrder 0 to the first account in a (kind, section) bucket, then max+1 for the next", async () => {
    const first = await createAccount({
      ...baseInput,
      name: "Pot",
      type: "SAVINGS",
      section: "MEDIUM_TERM",
      value: 100,
    });
    const firstAccount = await prisma.account.findUniqueOrThrow({
      where: { id: first.accountId },
    });
    expect(firstAccount.sortOrder).toBe(0);

    const second = await createAccount({
      ...baseInput,
      name: "Second pot",
      type: "SAVINGS",
      section: "MEDIUM_TERM",
      value: 50,
    });
    const secondAccount = await prisma.account.findUniqueOrThrow({
      where: { id: second.accountId },
    });
    expect(secondAccount.sortOrder).toBe(1);
  });

  it("scopes sortOrder to the (kind, section) bucket, ignoring accounts elsewhere", async () => {
    // A different (kind, section) bucket, sitting at a high sortOrder — must
    // not influence the SAVINGS/MEDIUM_TERM bucket below.
    const elsewhere = await typedAccount("Vanguard ISA", "STOCKS_ISA");
    await prisma.account.update({
      where: { id: elsewhere.id },
      data: { sortOrder: 99 },
    });

    const result = await createAccount({
      ...baseInput,
      name: "Pot",
      type: "SAVINGS",
      section: "MEDIUM_TERM",
      value: 100,
    });
    const account = await prisma.account.findUniqueOrThrow({
      where: { id: result.accountId },
    });
    expect(account.sortOrder).toBe(0);
  });

  // An ASSET and a LIABILITY can file under the very same section — SAVINGS
  // and OTHER_DEBT both accept LONG_TERM — so the bucket query has to filter
  // on kind too, not just section. Without `type: { in: typesOfKind }`, the
  // second account here would inherit the first's sortOrder instead of
  // starting its own kind's bucket at 0.
  it("keeps ASSET and LIABILITY sortOrder buckets separate within one shared section", async () => {
    const debt = await createAccount({
      ...baseInput,
      name: "Personal loan",
      type: "OTHER_DEBT",
      section: "LONG_TERM",
      value: 5000,
    });
    const debtAccount = await prisma.account.findUniqueOrThrow({
      where: { id: debt.accountId },
    });
    expect(debtAccount.sortOrder).toBe(0);

    const asset = await createAccount({
      ...baseInput,
      name: "Pot",
      type: "SAVINGS",
      section: "LONG_TERM",
      value: 100,
    });
    const assetAccount = await prisma.account.findUniqueOrThrow({
      where: { id: asset.accountId },
    });
    expect(assetAccount.sortOrder).toBe(0);
  });
});

describe("setAccountSection", () => {
  it("moves the account to the section the user picked", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await setAccountSection({ accountId: a.id, section: "LONG_TERM" });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(after.section).toBe("LONG_TERM");
    expect(after.type).toBe("SAVINGS"); // the type is untouched
  });

  // Liabilities · Property is not a thing: a mortgage files under Long-term
  // liabilities. The client never offers it — this is the server saying no.
  it("refuses PROPERTY on a liability", async () => {
    const debt = await typedAccount("Halifax mortgage", "MORTGAGE");
    await expect(
      setAccountSection({ accountId: debt.id, section: "PROPERTY" }),
    ).rejects.toThrow(/not a valid section/);
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: debt.id },
    });
    expect(after.section).toBe("LONG_TERM"); // unchanged
  });

  // The moved account lands at the end of its new section rather than
  // colliding with whatever already sits there — and only same-kind accounts
  // count, so an asset never inherits a liability's sortOrder.
  it("appends the account to the end of its new section", async () => {
    const sitting = await typedAccount("Vanguard ISA", "STOCKS_ISA");
    await prisma.account.update({
      where: { id: sitting.id },
      data: { section: "LONG_TERM", sortOrder: 7 },
    });
    const debt = await typedAccount("Halifax mortgage", "MORTGAGE");
    await prisma.account.update({
      where: { id: debt.id },
      data: { sortOrder: 99 },
    });

    const moving = await typedAccount("Pot", "SAVINGS");
    await setAccountSection({ accountId: moving.id, section: "LONG_TERM" });

    const after = await prisma.account.findUniqueOrThrow({
      where: { id: moving.id },
    });
    expect(after.sortOrder).toBe(8);
  });
});

describe("clearBalanceValue", () => {
  // Emptying the cell removes the observation rather than recording a zero:
  // the row is soft-deleted, and the sheet's left join goes back to showing
  // the account with nothing against it this month.
  it("soft-deletes this month's row, leaving the account without a value", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 250,
      notes: "Statement",
    });

    await clearBalanceValue({ accountId: a.id, year: 2026, month: 2 });

    const rows = await prisma.balanceItem.findMany({
      where: { accountId: a.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).not.toBeNull();
    expect(rows.filter((r) => r.deletedAt === null)).toHaveLength(0);

    // A fresh page query still lists the account — with an empty cell.
    const element = (await BalancePage({
      searchParams: Promise.resolve({ ym: "2026-03" }),
    })) as { props: { initialRows: SerializedAccountRow[] } };
    const row = element.props.initialRows.find((r) => r.accountId === a.id);
    expect(row).toBeDefined();
    expect(row?.value).toBeNull();
    expect(row?.notes).toBeNull();
  });
});
