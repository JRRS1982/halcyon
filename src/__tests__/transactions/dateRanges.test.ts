import { datePresets } from "@/lib/transactions/dateRanges";

// A mid-month day in a month long enough to expose off-by-one month maths.
const TODAY = new Date("2026-03-17T09:30:00.000Z");

describe("datePresets", () => {
  test("this month spans the calendar month containing today", () => {
    const preset = datePresets(TODAY).find((p) => p.label === "This month");
    expect(preset).toEqual({
      label: "This month",
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  test("last 3 months ends today and starts two months back", () => {
    const preset = datePresets(TODAY).find((p) => p.label === "Last 3 months");
    expect(preset).toEqual({
      label: "Last 3 months",
      from: "2026-01-01",
      to: "2026-03-17",
    });
  });

  test("this year spans January to today", () => {
    const preset = datePresets(TODAY).find((p) => p.label === "This year");
    expect(preset).toEqual({
      label: "This year",
      from: "2026-01-01",
      to: "2026-03-17",
    });
  });

  test("a month shorter than the last ends on its own final day", () => {
    // Rolling back from 31 March must not land on "31 February".
    const preset = datePresets(new Date("2026-02-05T00:00:00.000Z")).find(
      (p) => p.label === "This month",
    );
    expect(preset?.to).toBe("2026-02-28");
  });

  test("crossing a year boundary walks the year back, not the month to zero", () => {
    const preset = datePresets(new Date("2026-01-15T00:00:00.000Z")).find(
      (p) => p.label === "Last 3 months",
    );
    expect(preset?.from).toBe("2025-11-01");
  });
});
