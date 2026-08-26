import {
  createItemForMonthSchema,
  createItemSchema,
} from "@/lib/budget/schemas";

const base = { year: 2026, month: 2, label: "x" };
const uuid = "11111111-1111-4111-8111-111111111111";

describe("createItemForMonthSchema anchor invariants", () => {
  test("a TRANSFER needs an account and a direction", () => {
    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "TRANSFER",
        accountId: uuid,
        direction: "INFLOW",
      }),
    ).not.toThrow();

    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "TRANSFER",
        accountId: uuid,
      }),
    ).toThrow("TRANSFER needs a direction");

    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "TRANSFER",
        direction: "INFLOW",
      }),
    ).toThrow("TRANSFER needs an accountId");
  });

  test("a REPAYMENT needs an account and refuses a direction", () => {
    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "REPAYMENT",
        accountId: uuid,
      }),
    ).not.toThrow();

    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "REPAYMENT",
        accountId: uuid,
        direction: "INFLOW",
      }),
    ).toThrow("REPAYMENT cannot carry a direction");

    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "REPAYMENT",
      }),
    ).toThrow("REPAYMENT needs an accountId");
  });

  test("INCOME and EXPENSE refuse an account", () => {
    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "EXPENSE",
        accountId: uuid,
      }),
    ).toThrow("EXPENSE cannot carry an accountId");

    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "INCOME",
        accountId: uuid,
      }),
    ).toThrow("INCOME cannot carry an accountId");
  });

  test("INCOME and EXPENSE refuse a direction", () => {
    expect(() =>
      createItemForMonthSchema.parse({
        ...base,
        type: "EXPENSE",
        direction: "OUTFLOW",
      }),
    ).toThrow("EXPENSE cannot carry a direction");
  });

  test("a plain INCOME row with neither accountId nor direction still parses", () => {
    expect(() =>
      createItemForMonthSchema.parse({ ...base, type: "INCOME" }),
    ).not.toThrow();
  });
});

describe("createItemSchema anchor invariants", () => {
  const periodBase = { periodId: uuid, label: "x" };

  test("a TRANSFER needs an account and a direction", () => {
    expect(() =>
      createItemSchema.parse({
        ...periodBase,
        type: "TRANSFER",
        accountId: uuid,
        direction: "OUTFLOW",
      }),
    ).not.toThrow();

    expect(() =>
      createItemSchema.parse({
        ...periodBase,
        type: "TRANSFER",
        accountId: uuid,
      }),
    ).toThrow("TRANSFER needs a direction");
  });

  test("a REPAYMENT needs an account and refuses a direction", () => {
    expect(() =>
      createItemSchema.parse({
        ...periodBase,
        type: "REPAYMENT",
        accountId: uuid,
      }),
    ).not.toThrow();

    expect(() =>
      createItemSchema.parse({
        ...periodBase,
        type: "REPAYMENT",
        accountId: uuid,
        direction: "INFLOW",
      }),
    ).toThrow("REPAYMENT cannot carry a direction");
  });

  test("EXPENSE refuses an account", () => {
    expect(() =>
      createItemSchema.parse({
        ...periodBase,
        type: "EXPENSE",
        accountId: uuid,
      }),
    ).toThrow("EXPENSE cannot carry an accountId");
  });
});
