import { createItemForMonth } from "@/app/(app)/budget/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// `accountId` arrives from the client, and per ADR-002 the server-side Prisma
// role bypasses RLS — the action's own `userId` filter is the only fence there
// is. These tests pin both halves of it: the account must belong to the caller,
// and its kind must match the row's type.
//
// The signed-in user is fixed by the mocked Supabase client in
// test/integration/setup.ts (there is no `asUser` helper), so the cross-tenant
// case seeds a *second, real* user and gives them a real, correctly-kinded
// account — a test that passed because the id didn't exist would prove nothing.

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const seedOtherUser = () => prisma.user.create({ data: { id: OTHER_USER_ID } });

const createAccount = (
  userId: string,
  name: string,
  kind: "ASSET" | "LIABILITY",
) => prisma.account.create({ data: { userId, name, kind } });

describe("createItemForMonth anchor account fence (integration)", () => {
  test("rejects an account belonging to another user", async () => {
    const other = await seedOtherUser();
    const theirAccount = await createAccount(other.id, "Their ISA", "ASSET");

    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "TRANSFER",
        label: "x",
        accountId: theirAccount.id,
        direction: "INFLOW",
      }),
    ).rejects.toThrow(/account/i);

    // Nothing was written on the caller's side either.
    expect(
      await prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });

  test("rejects a soft-deleted account the caller owns", async () => {
    const archived = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Closed ISA",
        kind: "ASSET",
        deletedAt: new Date(),
      },
    });

    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "TRANSFER",
        label: "x",
        accountId: archived.id,
        direction: "INFLOW",
      }),
    ).rejects.toThrow(/account/i);
  });

  test("rejects a TRANSFER aimed at a liability", async () => {
    const debt = await createAccount(TEST_USER_ID, "Mortgage", "LIABILITY");

    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "TRANSFER",
        label: "x",
        accountId: debt.id,
        direction: "INFLOW",
      }),
    ).rejects.toThrow(/asset/i);
  });

  test("rejects a REPAYMENT aimed at an asset", async () => {
    const isa = await createAccount(TEST_USER_ID, "ISA", "ASSET");

    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "REPAYMENT",
        label: "x",
        accountId: isa.id,
      }),
    ).rejects.toThrow(/liability/i);
  });

  test("creates a repayment against an owned liability", async () => {
    const debt = await createAccount(TEST_USER_ID, "Mortgage", "LIABILITY");

    const { item } = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "REPAYMENT",
      label: "Mortgage",
      accountId: debt.id,
    });

    expect(item.type).toBe("REPAYMENT");
    // Reading these off the returned value also pins the client shape: tsc
    // fails here if the action stops exposing accountId/direction, which the
    // sheet needs to render the row and to sign its variance.
    expect(item.accountId).toBe(debt.id);
    expect(item.direction).toBeNull();
    expect(item.category).toBeNull();
    expect(item.incomeCategory).toBeNull();
  });

  test("creates a transfer against an owned asset, keeping its direction", async () => {
    const isa = await createAccount(TEST_USER_ID, "Vanguard ISA", "ASSET");

    const { item } = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "TRANSFER",
      label: "ISA saving",
      accountId: isa.id,
      direction: "OUTFLOW",
    });

    expect(item.type).toBe("TRANSFER");
    expect(item.accountId).toBe(isa.id);
    expect(item.direction).toBe("OUTFLOW");
    expect(item.category).toBeNull();
    expect(item.incomeCategory).toBeNull();
  });
});
