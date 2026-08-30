import { Prisma } from "@prisma/client";
import { toCarriedOverRows } from "@/lib/balance/copyRows";

describe("toCarriedOverRows", () => {
  test("copies fields across and marks every row carried over", () => {
    const rows = toCarriedOverRows([
      {
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: new Prisma.Decimal(42300),
        notes: "top-up due",
        sortOrder: 2,
        accountId: "acc-1",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "ASSET",
      category: "LONG_TERM",
      label: "Vanguard ISA",
      value: 42300,
      notes: "top-up due",
      sortOrder: 2,
      accountId: "acc-1",
      carriedOver: true,
    });
  });

  test("gives each copied row its own fresh id", () => {
    const rows = toCarriedOverRows([
      {
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Mortgage",
        value: new Prisma.Decimal(184200),
        notes: null,
        sortOrder: 1,
        accountId: "acc-1",
      },
      {
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Car loan",
        value: new Prisma.Decimal(5000),
        notes: null,
        sortOrder: 2,
        accountId: "acc-2",
      },
    ]);

    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first?.id).not.toBe(second?.id);
  });

  test("an empty source yields an empty copy", () => {
    expect(toCarriedOverRows([])).toEqual([]);
  });
});
