import { grossFor, taxOn } from "@/lib/tax/compute";

const rUK = { year: "2025/26", regime: "RUK" as const };

test("no tax below the personal allowance", () => {
  expect(taxOn({ income: 12_570, ...rUK }).tax).toBe(0);
});

test("basic rate only", () => {
  // 30,000 − 12,570 = 17,430 taxable at 20%
  expect(taxOn({ income: 30_000, ...rUK }).tax).toBe(3_486);
});

test("into the higher band", () => {
  expect(taxOn({ income: 60_000, ...rUK }).tax).toBe(11_432);
});

test("the taper stretch is an effective 60%", () => {
  // 100,000 → 27,432. Each further pound costs 60p.
  expect(taxOn({ income: 100_000, ...rUK }).tax).toBe(27_432);
  expect(taxOn({ income: 110_000, ...rUK }).tax).toBe(33_432);
});

test("the allowance is fully gone at 125,140", () => {
  expect(taxOn({ income: 125_140, ...rUK }).tax).toBe(42_516);
});

test("additional rate above 125,140", () => {
  expect(taxOn({ income: 130_000, ...rUK }).tax).toBe(44_703);
  expect(taxOn({ income: 200_000, ...rUK }).tax).toBe(76_203);
});

test("zero and negative income are not taxed", () => {
  expect(taxOn({ income: 0, ...rUK }).tax).toBe(0);
  expect(taxOn({ income: -5_000, ...rUK }).tax).toBe(0);
});

test("nets exactly what was asked for, from zero", () => {
  const { gross, tax } = grossFor({ net: 30_000, alreadyTaxed: 0, ...rUK });
  expect(gross - tax).toBe(30_000);
});

test("starts where existing income left off", () => {
  // 20,000 of income has already used the allowance and part of the basic band.
  const { gross, tax } = grossFor({
    net: 10_000,
    alreadyTaxed: 20_000,
    ...rUK,
  });
  expect(gross - tax).toBe(10_000);
  // Every pound is in the basic band: gross = 10,000 / 0.8
  expect(gross).toBe(12_500);
});

test("the allowance is not granted twice", () => {
  // The whole point. Income 20,000 + a withdrawal netting 30,000 must be taxed
  // as ONE income, so the combined tax equals taxOn(total).
  const { gross, tax } = grossFor({
    net: 30_000,
    alreadyTaxed: 20_000,
    ...rUK,
  });
  const combined = taxOn({ income: 20_000 + gross, ...rUK }).tax;
  const onIncomeAlone = taxOn({ income: 20_000, ...rUK }).tax;
  expect(tax).toBe(combined - onIncomeAlone);
});

// Total-income boundaries where a band starts or ends, for each regime — the
// personal allowance edge, every band ceiling, and (RUK) the taper start/end.
// Derived from bands.ts's taxable-income ceilings by adding back the £12,570
// allowance.
const RUK_BOUNDARIES = [12_570, 50_270, 100_000, 125_140];
const SCOTLAND_BOUNDARIES = [
  12_570, 15_397, 27_491, 43_662, 75_000, 100_000, 125_140,
];

const around = (boundary: number): number[] => [
  boundary - 1,
  boundary,
  boundary + 1,
];

const NET_TARGETS = [
  1, 500, 999, 1_000, 12_570, 30_000, 80_000, 150_000, 500_000, 1_000_000,
];

test("inverse property holds across a spread, including every band boundary ±1 and the taper zone", () => {
  const startingPoints: Array<{
    alreadyTaxed: number;
    regime: "RUK" | "SCOTLAND";
  }> = [
    { alreadyTaxed: 0, regime: "RUK" },
    { alreadyTaxed: 0, regime: "SCOTLAND" },
    ...RUK_BOUNDARIES.flatMap((b) =>
      around(b).map((alreadyTaxed) => ({
        alreadyTaxed,
        regime: "RUK" as const,
      })),
    ),
    ...SCOTLAND_BOUNDARIES.flatMap((b) =>
      around(b).map((alreadyTaxed) => ({
        alreadyTaxed,
        regime: "SCOTLAND" as const,
      })),
    ),
    // Above the top band, both regimes.
    { alreadyTaxed: 130_000, regime: "RUK" },
    { alreadyTaxed: 200_000, regime: "RUK" },
    { alreadyTaxed: 300_000, regime: "RUK" },
    { alreadyTaxed: 130_000, regime: "SCOTLAND" },
    { alreadyTaxed: 200_000, regime: "SCOTLAND" },
    { alreadyTaxed: 300_000, regime: "SCOTLAND" },
  ];

  for (const { alreadyTaxed, regime } of startingPoints) {
    for (const net of NET_TARGETS) {
      const { gross, tax } = grossFor({
        net,
        alreadyTaxed,
        year: "2025/26",
        regime,
      });
      expect(gross - tax).toBe(net);
      const delta =
        taxOn({ income: alreadyTaxed + gross, year: "2025/26", regime }).tax -
        taxOn({ income: alreadyTaxed, year: "2025/26", regime }).tax;
      expect(tax).toBe(delta);
    }
  }
});

test("crossing a band boundary", () => {
  // Withdrawal that starts in basic and ends in higher.
  const { gross, tax } = grossFor({
    net: 40_000,
    alreadyTaxed: 40_000,
    ...rUK,
  });
  expect(gross - tax).toBe(40_000);
});

test("works for Scotland's seven bands unchanged", () => {
  const { gross, tax } = grossFor({
    net: 30_000,
    alreadyTaxed: 20_000,
    year: "2025/26",
    regime: "SCOTLAND",
  });
  expect(gross - tax).toBe(30_000);
});
