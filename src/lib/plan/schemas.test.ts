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
  returnSpreadPct: 2,
  taxRegime: "RUK",
  thresholdsInflationLinked: true,
  statePensionAge: 67,
  statePensionAnnual: 11500,
  expectedDeathAge: 90,
};

const validAsset = {
  assetId: "22222222-2222-4222-8222-222222222222",
  label: "SIPP",
  wrapper: "PENSION",
  openingValue: 100000,
  expectedReturnPct: 5,
  feePct: 0,
  annualContribution: 6000,
  contributionEndAge: null,
  minAccessAge: null,
  drawdownPriority: 2,
};

const validLiability = {
  liabilityId: "33333333-3333-4333-8333-333333333333",
  label: "Mortgage",
  openingBalance: 120000,
  interestPct: 4,
  monthlyRepayment: 1100,
  startAge: null,
  endAge: 60,
  linkedAssetId: null,
  interestOnly: false,
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
  it("rejects an out-of-range returnSpreadPct", () => {
    expect(() =>
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        returnSpreadPct: 11,
      }),
    ).toThrow();
    expect(() =>
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        returnSpreadPct: -1,
      }),
    ).toThrow();
  });
  it("accepts SCOTLAND and rejects an unknown regime", () => {
    expect(
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        taxRegime: "SCOTLAND",
      }).taxRegime,
    ).toBe("SCOTLAND");
    expect(() =>
      updatePlanAssumptionsSchema.parse({
        ...validAssumptions,
        taxRegime: "ENGLAND",
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
  it("rejects out-of-range feePct and minAccessAge", () => {
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, feePct: 6 }),
    ).toThrow();
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, feePct: -1 }),
    ).toThrow();
    expect(() =>
      updatePlanAssetSchema.parse({ ...validAsset, minAccessAge: 40 }),
    ).toThrow();
    expect(
      updatePlanAssetSchema.parse({ ...validAsset, minAccessAge: null })
        .minAccessAge,
    ).toBeNull();
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

describe("updatePlanLiabilitySchema startAge", () => {
  const base = {
    liabilityId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    label: "Mortgage",
    openingBalance: 100000,
    interestPct: 4,
    monthlyRepayment: 1200,
    endAge: 65,
    linkedAssetId: null,
    interestOnly: false,
  };

  it("accepts a null startAge", () => {
    expect(
      updatePlanLiabilitySchema.parse({ ...base, startAge: null }).startAge,
    ).toBeNull();
  });

  it("accepts startAge before endAge", () => {
    expect(
      updatePlanLiabilitySchema.parse({ ...base, startAge: 40 }).startAge,
    ).toBe(40);
  });

  it("rejects startAge after endAge", () => {
    expect(() =>
      updatePlanLiabilitySchema.parse({ ...base, startAge: 70 }),
    ).toThrow();
  });
});
