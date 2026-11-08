import { labelledMonths } from "@/lib/dashboard/netLabels";

// The cash-flow chart labels each month's surplus. On a phone eleven chips
// overlap into an unreadable row, so a narrow chart labels only the months
// worth reading: the latest, the best and the worst.
describe("labelledMonths", () => {
  const nets = [1200, 695, 1300, 4800, 1200, 2000, -754, 1500];

  it("labels every month when there is room", () => {
    expect([...labelledMonths(nets, { roomForAll: true })]).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("labels the latest, best and worst months when there is not", () => {
    expect([...labelledMonths(nets, { roomForAll: false })].sort()).toEqual([
      3, 6, 7,
    ]);
  });

  it("labels a month once when it is both the latest and the best", () => {
    expect(
      [...labelledMonths([100, 200, 900], { roomForAll: false })].sort(),
    ).toEqual([0, 2]);
  });

  it("labels nothing for no months", () => {
    expect(labelledMonths([], { roomForAll: false }).size).toBe(0);
  });
});
