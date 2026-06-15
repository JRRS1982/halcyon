// src/lib/plan/assets.test.ts
import { contributionTargetId } from "./assets";
import type { AssetInput } from "./types";

const asset = (over: Partial<AssetInput> & { id: string }): AssetInput => ({
  label: over.id,
  wrapper: "GIA",
  openingValue: 0,
  drawdownPriority: 0,
  ...over,
});

describe("contributionTargetId", () => {
  it("prefers the CASH account (the buffer)", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 3 }),
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("cash");
  });
  it("falls back to the most-liquid non-PROPERTY asset when there is no cash", () => {
    const assets = [
      asset({ id: "gia", wrapper: "GIA", drawdownPriority: 2 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("isa");
  });
  it("returns null when there are no assets", () => {
    expect(contributionTargetId([])).toBeNull();
  });
});
