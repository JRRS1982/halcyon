import { Prisma } from "@prisma/client";
import { serializeExport } from "@/lib/data/serialize";

describe("serializeExport", () => {
  test("renders Prisma Decimal as a string and Date as ISO-8601", () => {
    const json = serializeExport({
      amount: new Prisma.Decimal("12.50"),
      when: new Date("2026-01-02T03:04:05.000Z"),
      nested: { total: new Prisma.Decimal("-7") },
    });
    const parsed = JSON.parse(json);
    expect(parsed.amount).toBe("12.5");
    expect(parsed.when).toBe("2026-01-02T03:04:05.000Z");
    expect(parsed.nested.total).toBe("-7");
  });

  test("produces pretty-printed JSON", () => {
    const json = serializeExport({ a: 1 });
    expect(json).toContain("\n");
  });
});
