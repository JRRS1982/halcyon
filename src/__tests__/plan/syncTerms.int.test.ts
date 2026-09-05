// Task 11: Sync now compares and carries every projection parameter, not just
// value/label/wrapper/flow. One case per parameter proves it actually arrives
// at the plan column a second Sync should have written it to — a failure here
// names the exact parameter that stopped travelling. The final test is the
// other half of the guard: the two date→age conversions (revisionDate,
// endDate) must be compared *after* conversion, or a Sync that changed
// nothing would report a change forever.

import type { AccountType } from "@prisma/client";
import {
  setAccountTerms,
  setAccountType,
} from "@/app/(app)/balance/accountActions";
import { updatePlanLiability } from "@/app/(app)/plan/actions";
import { syncPlan } from "@/app/(app)/plan/syncActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function period(label: string, start: string) {
  return prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      startDate: new Date(start),
      endDate: new Date(start),
      granularity: "MONTH",
      label,
    },
  });
}

// A plan whose owner was born in 1984-03-01, so 2029-06-01 is age 45 and
// 2049-06-01 is age 65 — every ageOnDate conversion below is pinned against
// this date of birth.
async function planWithAccount(type: AccountType) {
  const account = await prisma.account.create({
    data: {
      userId: TEST_USER_ID,
      name: `Test ${type}`,
      ...buildAccountData({ type }),
    },
  });
  const p = await period("2026-09-01", "2026-09-01");
  await prisma.balanceItem.create({
    data: { periodId: p.id, accountId: account.id, value: 100_000 },
  });
  const plan = await prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1984-03-01"),
      retirementAge: 60,
    },
  });
  return { account, plan };
}

// Each entry: the account type to test on, the terms payload to write, and
// the PlanAsset/PlanLiability column that must hold the result after a Sync.
const CASES = [
  {
    type: "STOCKS_ISA",
    terms: { expectedReturnPct: 4.5 },
    on: "asset",
    column: "expectedReturnPct",
    expected: 4.5,
  },
  {
    type: "STOCKS_ISA",
    terms: { feePct: 0.35 },
    on: "asset",
    column: "feePct",
    expected: 0.35,
  },
  {
    type: "SIPP",
    terms: { minAccessAge: 58 },
    on: "asset",
    column: "minAccessAge",
    expected: 58,
  },
  {
    type: "FINAL_SALARY",
    terms: { annualIncome: 12_500 },
    on: "asset",
    column: "annualIncome",
    expected: 12_500,
  },
  {
    type: "FINAL_SALARY",
    terms: { endDate: new Date("2049-06-01") },
    on: "asset",
    column: "incomeFromAge",
    expected: 65,
  },
  {
    type: "MORTGAGE",
    terms: { interestPct: 4.29 },
    on: "liability",
    column: "interestPct",
    expected: 4.29,
  },
  {
    type: "MORTGAGE",
    terms: { interestOnly: true },
    on: "liability",
    column: "interestOnly",
    expected: true,
  },
  {
    type: "MORTGAGE",
    terms: { revisionRate: 6.75 },
    on: "liability",
    column: "revisionRate",
    expected: 6.75,
  },
  {
    type: "MORTGAGE",
    terms: { revisionDate: new Date("2029-06-01") },
    on: "liability",
    column: "revisionAge",
    expected: 45,
  },
  {
    type: "MORTGAGE",
    terms: { endDate: new Date("2049-06-01") },
    on: "liability",
    column: "endAge",
    expected: 65,
  },
] as const;

describe("Sync carries every parameter", () => {
  for (const testCase of CASES) {
    it(`carries ${testCase.column} to the plan's ${testCase.on}`, async () => {
      const { account } = await planWithAccount(testCase.type);
      // First Sync creates the row from the account.
      await syncPlan();

      await setAccountTerms({ accountId: account.id, terms: testCase.terms });
      // Second Sync must notice the parameter changed and write it through.
      await syncPlan();

      const row =
        testCase.on === "asset"
          ? await prisma.planAsset.findFirstOrThrow({
              where: { accountId: account.id },
            })
          : await prisma.planLiability.findFirstOrThrow({
              where: { accountId: account.id },
            });

      const actual = (row as Record<string, unknown>)[testCase.column];
      const value = typeof actual === "boolean" ? actual : Number(actual);
      expect(value).toBe(testCase.expected);
    });
  }

  // The point of the whole defence: the two converted parameters compare as
  // ages, not as dates. If either were compared before conversion, this
  // second Sync — with nothing actually changed — would report an update
  // forever, every time the user pressed the button.
  it("reports up to date when nothing changed, twice running", async () => {
    const { account } = await planWithAccount("MORTGAGE");
    await setAccountTerms({
      accountId: account.id,
      terms: {
        interestPct: 4.29,
        revisionDate: new Date("2029-06-01"),
        endDate: new Date("2049-06-01"),
      },
    });
    await syncPlan();

    const second = await syncPlan();

    expect(second.updates).toHaveLength(0);
  });

  // The door. accountTermsSchema accepts all nine fields for any account — it
  // is one shape — so which of them an account may carry is enforced by the
  // action, against the type on the row it is writing to.
  it("refuses liability-only terms written to an asset account", async () => {
    const { account } = await planWithAccount("STOCKS_ISA");

    await expect(
      setAccountTerms({
        accountId: account.id,
        terms: { interestPct: 4.29, interestOnly: true },
      }),
    ).rejects.toThrow(/interestPct/);
  });

  // The mirror image: asset-only terms aimed at a liability account.
  it("refuses asset-only terms written to a liability account", async () => {
    const { account } = await planWithAccount("MORTGAGE");

    await expect(
      setAccountTerms({
        accountId: account.id,
        terms: { annualIncome: 12_500 },
      }),
    ).rejects.toThrow(/annualIncome/);
  });

  // The safety net behind that door, and the reason it is needed: a type
  // change leaves the AccountTerms row alone, so an out-of-kind value can
  // exist without any action having written it. Written straight to the
  // database here, exactly as a FINAL_SALARY → SIPP change would leave it.
  // reality.ts must read it as not this account's, or the row would compare
  // against the plan row's hard-coded opposite (toLoadedPlan sets these to
  // null/false for the wrong kind) and report changed on every Sync, forever.
  it("ignores an out-of-kind term already stored against an asset", async () => {
    const { account } = await planWithAccount("STOCKS_ISA");
    await syncPlan();

    await prisma.accountTerms.create({
      data: {
        accountId: account.id,
        interestPct: 4.29,
        interestOnly: true,
        revisionRate: 6.75,
        revisionDate: new Date("2029-06-01"),
      },
    });
    const second = await syncPlan();

    expect(second.updates).toHaveLength(0);
  });

  it("ignores an out-of-kind term already stored against a liability", async () => {
    const { account } = await planWithAccount("MORTGAGE");
    await syncPlan();

    await prisma.accountTerms.create({
      data: {
        accountId: account.id,
        expectedReturnPct: 4.5,
        feePct: 0.35,
        minAccessAge: 58,
        annualIncome: 12_500,
      },
    });
    const second = await syncPlan();

    expect(second.updates).toHaveLength(0);
  });
});

// The parameters an account carries are declared by its *type*, and the type
// can change under them: setAccountType deliberately leaves AccountTerms
// alone rather than silently deleting a user's data. Everything downstream
// therefore has to treat a parameter the current type does not prompt for as
// not this account's — otherwise a misfiling corrected in two clicks leaves a
// value no card renders, no gesture can clear, and every Sync re-applies.
describe("a type change strands the parameters of the old type", () => {
  it("stops a corrected final-salary pension zeroing its SIPP balance", async () => {
    const { account } = await planWithAccount("FINAL_SALARY");
    await setAccountTerms({
      accountId: account.id,
      terms: { annualIncome: 12_000, endDate: new Date("2049-06-01") },
    });
    await syncPlan();

    // Both ASSET, so the card offers this and the action allows it.
    await setAccountType({ accountId: account.id, type: "SIPP" });
    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    // A SIPP is a pot. An entitlement left on it would exclude the balance
    // from the projection entirely and pay a phantom £12,000/yr to the end of
    // the plan.
    expect(asset.annualIncome).toBeNull();
    expect(asset.incomeFromAge).toBeNull();
    expect(Number(asset.openingValue)).toBe(100_000);
  });

  it("stops a mortgage's interest-only flag reaching a loan", async () => {
    const { account } = await planWithAccount("MORTGAGE");
    await setAccountTerms({
      accountId: account.id,
      terms: { interestOnly: true, endDate: new Date("2049-06-01") },
    });
    await syncPlan();

    await setAccountType({ accountId: account.id, type: "LOAN" });
    await syncPlan();

    const liability = await prisma.planLiability.findFirstOrThrow({
      where: { accountId: account.id },
    });
    // A LOAN's card has no interest-only control, so a true here could never
    // be turned off — and the principal would never amortise. endAge stays:
    // a LOAN does prompt for a payoff date.
    expect(liability.interestOnly).toBe(false);
    expect(liability.endAge).toBe(65);
  });

  // The other half: the stranded value must not make the row read as changed
  // on every Sync either.
  it("reports up to date once the stranded parameter is ignored", async () => {
    const { account } = await planWithAccount("FINAL_SALARY");
    await setAccountTerms({
      accountId: account.id,
      terms: { annualIncome: 12_000, endDate: new Date("2049-06-01") },
    });
    await syncPlan();
    await setAccountType({ accountId: account.id, type: "SIPP" });
    await syncPlan();

    const third = await syncPlan();

    expect(third.updates).toHaveLength(0);
  });
});

// Sync writes through Prisma, bypassing zod — so anything it can copy from an
// account has to be inside the plan schemas' bounds, or the row it wrote can
// never be edited again. A 39.9% overdraft is the natural case: the going UK
// rate, and outside the old -20…30 "plausible" range.
describe("a real-world rate does not lock the plan row", () => {
  it("lets a synced 39.9% overdraft be edited afterwards", async () => {
    const { account } = await planWithAccount("OVERDRAFT");
    await setAccountTerms({
      accountId: account.id,
      terms: { interestPct: 39.9 },
    });
    await syncPlan();

    const liability = await prisma.planLiability.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(liability.interestPct)).toBe(39.9);

    // A label change — the cheapest possible edit — re-sends every field
    // through updatePlanLiabilitySchema. Before the bounds were widened this
    // threw, and no edit of this row could ever be saved.
    await expect(
      updatePlanLiability({
        liabilityId: liability.id,
        label: "Overdraft (renamed)",
        openingBalance: Number(liability.openingBalance),
        interestPct: Number(liability.interestPct),
        monthlyRepayment: Number(liability.monthlyRepayment),
        startAge: liability.startAge,
        endAge: liability.endAge,
        linkedAssetId: liability.linkedAssetId,
        interestOnly: liability.interestOnly,
        revisionAge: liability.revisionAge,
        revisionRate:
          liability.revisionRate === null
            ? null
            : Number(liability.revisionRate),
      }),
    ).resolves.not.toThrow();
  });
});
