import {
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanLiabilitySchema,
} from "./schemas";

const validAssumptions = {
  planId: "11111111-1111-4111-8111-111111111111",
  dateOfBirth: "1986-06-01",
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 2.5,
  defaultReturnPct: 5,
  blendedTaxRatePct: 20,
  statePensionAge: 67,
  statePensionAnnual: 11500,
};

const validAsset = {
  assetId: "22222222-2222-4222-8222-222222222222",
  label: "SIPP",
  wrapper: "PENSION",
  openingValue: 100000,
  expectedReturnPct: 5,
  annualContribution: 6000,
  drawdownPriority: 2,
};

const validLiability = {
  liabilityId: "33333333-3333-4333-8333-333333333333",
  label: "Mortgage",
  openingBalance: 120000,
  interestPct: 4,
  monthlyRepayment: 1100,
  endAge: 60,
};

describe("updatePlanAssumptionsSchema", () => {
  it("accepts valid input and nullable state pension", () => {
    expect(updatePlanAssumptionsSchema.parse(validAssumptions)).toMatchObject({
      retirementAge: 65,
    });
    expect(
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        statePensionAge: null,
        statePensionAnnual: null,
      }).statePensionAge,
    ).toBeNull();
  });
  it("rejects out-of-range retirementAge", () => {
    expect(() =>
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        retirementAge: 39,
      }),
    ).toThrow();
  });
  it("rejects a bad dateOfBirth", () => {
    expect(() =>
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        dateOfBirth: "01/06/1986",
      }),
    ).toThrow();
  });
});

describe("updatePlanAssetSchema", () => {
  it("accepts valid input and a null expectedReturnPct", () => {
    expect(updatePlanAssetSchema.parse(validAsset).wrapper).toBe("PENSION");
    expect(
      updatePlanAssetSchema.parse({ ...validAsset, expectedReturnPct: null })
        .expectedReturnPct,
    ).toBeNull();
  });
  it("rejects an unknown wrapper", () => {
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, wrapper: "CRYPTO" }),
    ).toThrow();
  });
  it("rejects a negative openingValue", () => {
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, openingValue: -1 }),
    ).toThrow();
  });
});

describe("updatePlanLiabilitySchema", () => {
  it("accepts valid input and a null endAge", () => {
    expect(updatePlanLiabilitySchema.parse(validLiability).label).toBe(
      "Mortgage",
    );
    expect(
      updatePlanLiabilitySchema.parse({ ...validLiability, endAge: null })
        .endAge,
    ).toBeNull();
  });
  it("rejects a negative monthlyRepayment", () => {
    expect(() =>
      updatePlanLiabilitySchema.parse({
        ...validLiability,
        monthlyRepayment: -5,
      }),
    ).toThrow();
  });
});
