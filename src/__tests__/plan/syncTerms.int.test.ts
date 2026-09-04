// Task 11: Sync now compares and carries every projection parameter, not just
// value/label/wrapper/flow. One case per parameter proves it actually arrives
// at the plan column a second Sync should have written it to — a failure here
// names the exact parameter that stopped travelling. The final test is the
// other half of the guard: the two date→age conversions (revisionDate,
// endDate) must be compared *after* conversion, or a Sync that changed
// nothing would report a change forever.

import type { AccountType } from "@prisma/client";
import { setAccountTerms } from "@/app/(app)/balance/accountActions";
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

  // The unenforced-invariant guard. accountTermsSchema accepts any field for
  // any account, and setAccountTerms never checks the account's type — so
  // nothing stops a liability-only value from landing on an asset account's
  // AccountTerms row (a UI bug, or any future direct caller). reality.ts must
  // still read it as irrelevant to this kind, or the row would compare
  // against the plan row's hard-coded opposite (toLoadedPlan sets these to
  // null/false for the wrong kind) and report changed on every Sync, forever.
  it("ignores liability-only terms written to an asset account", async () => {
    const { account } = await planWithAccount("STOCKS_ISA");
    await syncPlan();

    await setAccountTerms({
      accountId: account.id,
      terms: {
        interestPct: 4.29,
        interestOnly: true,
        revisionRate: 6.75,
        revisionDate: new Date("2029-06-01"),
      },
    });
    const second = await syncPlan();

    expect(second.updates).toHaveLength(0);
  });

  // The mirror image: asset-only terms stranded on a liability account.
  it("ignores asset-only terms written to a liability account", async () => {
    const { account } = await planWithAccount("MORTGAGE");
    await syncPlan();

    await setAccountTerms({
      accountId: account.id,
      terms: {
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
