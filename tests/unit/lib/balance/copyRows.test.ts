import { Prisma } from "@prisma/client";
import { toCarriedOverRows } from "@/lib/balance/copyRows";

describe("toCarriedOverRows", () => {
  test("copies the account and value, and marks the row carried over", () => {
    const rows = toCarriedOverRows([
      { accountId: "acc-1", value: new Prisma.Decimal(42300) },
    ]);

    expect(rows).toEqual([
      { accountId: "acc-1", value: 42300, carriedOver: true },
    ]);
  });

  test("carries several rows, one per account", () => {
    const rows = toCarriedOverRows([
      { accountId: "acc-1", value: new Prisma.Decimal(184200) },
      { accountId: "acc-2", value: new Prisma.Decimal(5000) },
    ]);

    expect(rows).toEqual([
      { accountId: "acc-1", value: 184200, carriedOver: true },
      { accountId: "acc-2", value: 5000, carriedOver: true },
    ]);
  });

  test("an empty source yields an empty copy", () => {
    expect(toCarriedOverRows([])).toEqual([]);
  });
});
