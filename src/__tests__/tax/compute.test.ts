import { taxOn } from "@/lib/tax/compute";

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
