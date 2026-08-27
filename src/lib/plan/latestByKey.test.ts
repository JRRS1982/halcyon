import { latestByKey } from "./latestByKey";

type Row = { key: string | null; value: number };

describe("latestByKey", () => {
  it("keeps the first row seen per key and drops the rest", () => {
    const rows: Row[] = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
      { key: "a", value: 3 },
    ];

    const latest = latestByKey(rows, (r) => r.key);

    expect(latest.get("a")).toEqual({ key: "a", value: 1 });
    expect(latest.get("b")).toEqual({ key: "b", value: 2 });
  });

  // The caller orders newest-first, so "first seen" is "most recent". This is
  // the tie-break the query's secondary `createdAt` sort exists to feed.
  it("treats the earlier position as the more recent row", () => {
    const rows: Row[] = [
      { key: "a", value: 200 },
      { key: "a", value: 100 },
    ];

    expect(latestByKey(rows, (r) => r.key).get("a")?.value).toBe(200);
  });

  it("skips rows whose key is null rather than bucketing them together", () => {
    const rows: Row[] = [
      { key: null, value: 1 },
      { key: null, value: 2 },
      { key: "a", value: 3 },
    ];

    const latest = latestByKey(rows, (r) => r.key);

    expect(latest.size).toBe(1);
    expect(latest.get("a")?.value).toBe(3);
  });

  // Absent and zero must stay distinguishable: reality.ts skips an account
  // with no observation but reads zero for one with no budgeted flow.
  it("leaves a key with no row absent, not present holding a default", () => {
    const latest = latestByKey([{ key: "a", value: 0 }] as Row[], (r) => r.key);

    expect(latest.has("a")).toBe(true);
    expect(latest.has("b")).toBe(false);
    expect(latest.get("b")).toBeUndefined();
  });

  it("returns an empty map for no rows", () => {
    expect(latestByKey([] as Row[], (r) => r.key).size).toBe(0);
  });

  // Composite keys are how reality.ts keeps a TRANSFER and a REPAYMENT for the
  // same account from shadowing one another.
  it("separates rows that share an id but differ in the rest of the key", () => {
    const rows = [
      { id: "acc", type: "REPAYMENT", value: 1 },
      { id: "acc", type: "TRANSFER", value: 2 },
      { id: "acc", type: "TRANSFER", value: 3 },
    ];

    const latest = latestByKey(rows, (r) => `${r.id}:${r.type}`);

    expect(latest.get("acc:REPAYMENT")?.value).toBe(1);
    expect(latest.get("acc:TRANSFER")?.value).toBe(2);
  });
});
