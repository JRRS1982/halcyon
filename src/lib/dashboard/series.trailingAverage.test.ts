import { trailingAverageSeries } from "@/lib/dashboard/series";

const pts = (...values: number[]) =>
  values.map((value, i) => ({ month: `M${i}`, value }));

describe("trailingAverageSeries", () => {
  test("a single point's average is its own value", () => {
    expect(trailingAverageSeries(pts(100))).toEqual([
      { month: "M0", value: 100, avg: 100 },
    ]);
  });

  test("the average is the running mean until the window fills", () => {
    const out = trailingAverageSeries(pts(100, 200), 6);
    expect(out[0]?.avg).toBe(100);
    expect(out[1]?.avg).toBe(150); // (100 + 200) / 2
  });

  test("once past the window it averages only the trailing N (inclusive)", () => {
    // 7 points of value = index*100; window 6 → point 6 averages points 1..6
    const out = trailingAverageSeries(pts(0, 100, 200, 300, 400, 500, 600), 6);
    // mean of 100,200,300,400,500,600 = 350
    expect(out[6]?.avg).toBe(350);
  });

  test("keeps each point's own value alongside the average", () => {
    const out = trailingAverageSeries(pts(10, 20, 30));
    expect(out.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  test("empty input returns empty", () => {
    expect(trailingAverageSeries([])).toEqual([]);
  });
});
