import {
  daysApartLabel,
  hiddenPairs,
  isMatch,
  liveDismissals,
  type PairCandidate,
  pairKey,
  pairPossibleTransfers,
  pairWarnings,
  snapshotOf,
} from "@/lib/transactions/possibleTransfers";

const row = (
  id: string,
  date: string,
  amount: number,
  accountId: string,
  transferAccountId: string | null = null,
): PairCandidate => ({ id, date, amount, accountId, transferAccountId });

const NONE = new Set<string>();
const ids = (pairs: { outId: string; inId: string }[]) =>
  pairs.map((p) => [p.outId, p.inId]);

describe("isMatch", () => {
  test("opposite amounts in different accounts within three days match", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", -200, "cur"),
        row("b", "2026-11-04", 200, "sav"),
      ),
    ).toBe(true);
  });

  test("four days apart is outside the window", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", -200, "cur"),
        row("b", "2026-11-05", 200, "sav"),
      ),
    ).toBe(false);
  });

  test("two rows in the same account never match", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", -200, "cur"),
        row("b", "2026-11-01", 200, "cur"),
      ),
    ).toBe(false);
  });

  test("the same sign never matches", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", -200, "cur"),
        row("b", "2026-11-01", -200, "sav"),
      ),
    ).toBe(false);
  });

  test("a zero row never matches", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", 0, "cur"),
        row("b", "2026-11-01", 0, "sav"),
      ),
    ).toBe(false);
  });

  test("amounts compare to the penny, not in floating point", () => {
    expect(
      isMatch(
        row("a", "2026-11-01", -0.3, "cur"),
        row("b", "2026-11-01", 0.1 + 0.2, "sav"),
      ),
    ).toBe(true);
  });
});

describe("pairPossibleTransfers", () => {
  test("pairs a move out of one account with the move into another", () => {
    const pairs = pairPossibleTransfers(
      [
        row("in", "2026-11-04", 200, "sav"),
        row("out", "2026-11-03", -200, "cur"),
      ],
      NONE,
    );
    expect(pairs).toEqual([
      {
        outId: "out",
        inId: "in",
        amount: 200,
        daysApart: 1,
        earlierDate: "2026-11-03",
        otherMatches: 0,
        isTaggedElsewhere: false,
      },
    ]);
  });

  test("a row pairs with the nearest-dated match after it and flags the other", () => {
    const pairs = pairPossibleTransfers(
      [
        row("out", "2026-11-12", -20, "cur"),
        row("later", "2026-11-14", 20, "monzo"),
        row("sooner", "2026-11-13", 20, "sav"),
      ],
      NONE,
    );
    expect(ids(pairs)).toEqual([["out", "sooner"]]);
    expect(pairs[0]?.otherMatches).toBe(1);
  });

  test("on the same date the lower id goes first, so the pairing is stable", () => {
    const rows = [
      row("out", "2026-11-12", -20, "cur"),
      row("b-in", "2026-11-12", 20, "sav"),
      row("a-in", "2026-11-12", 20, "monzo"),
    ];
    expect(ids(pairPossibleTransfers(rows, NONE))).toEqual([["out", "a-in"]]);
    expect(ids(pairPossibleTransfers([...rows].reverse(), NONE))).toEqual([
      ["out", "a-in"],
    ]);
  });

  test("two outs and two ins make two pairs, each with one rival", () => {
    const pairs = pairPossibleTransfers(
      [
        row("o1", "2026-11-01", -50, "cur"),
        row("o2", "2026-11-01", -50, "cur"),
        row("i1", "2026-11-02", 50, "sav"),
        row("i2", "2026-11-02", 50, "sav"),
      ],
      NONE,
    );
    expect(ids(pairs)).toHaveLength(2);
    expect(pairs.every((p) => p.otherMatches === 2)).toBe(true);
  });

  test("hiding A–B lets A pair with another candidate C", () => {
    const rows = [
      row("a", "2026-11-01", -75, "cur"),
      row("b", "2026-11-01", 75, "sav"),
      row("c", "2026-11-02", 75, "monzo"),
    ];
    const pairs = pairPossibleTransfers(rows, new Set([pairKey("a", "b")]));
    expect(ids(pairs)).toEqual([["a", "c"]]);
    // B is the hidden pair's own row, not a rival: no warning.
    expect(pairs[0]?.otherMatches).toBe(0);
  });

  test("a row tagged to the other side's account is not a warning", () => {
    const [pair] = pairPossibleTransfers(
      [
        row("out", "2026-11-10", -500, "cur", "isa"),
        row("in", "2026-11-10", 500, "isa", "cur"),
      ],
      NONE,
    );
    expect(pair?.isTaggedElsewhere).toBe(false);
  });

  test("a row tagged to a third account is flagged", () => {
    const [pair] = pairPossibleTransfers(
      [
        row("out", "2026-11-10", -500, "cur", "pension"),
        row("in", "2026-11-10", 500, "isa"),
      ],
      NONE,
    );
    expect(pair?.isTaggedElsewhere).toBe(true);
  });

  test("lists the newest pair first, by its earlier date", () => {
    const pairs = pairPossibleTransfers(
      [
        row("o1", "2026-01-01", -10, "cur"),
        row("i1", "2026-01-02", 10, "sav"),
        row("o2", "2026-03-01", -11, "cur"),
        row("i2", "2026-03-01", 11, "sav"),
      ],
      NONE,
    );
    expect(ids(pairs)).toEqual([
      ["o2", "i2"],
      ["o1", "i1"],
    ]);
  });
});

describe("dismissals", () => {
  const out = row("a", "2026-11-01", -75, "cur");
  const back = row("b", "2026-11-02", 75, "sav");

  test("a snapshot is stored in id order, whichever side is named first", () => {
    expect(snapshotOf(back, out)).toEqual({
      firstId: "a",
      secondId: "b",
      firstAmount: -75,
      firstDate: "2026-11-01",
      firstAccountId: "cur",
      secondAmount: 75,
      secondDate: "2026-11-02",
      secondAccountId: "sav",
    });
  });

  test("a dismissal holds while both rows still match the snapshot", () => {
    const snapshot = snapshotOf(out, back);
    expect(liveDismissals([out, back], [snapshot])).toEqual([snapshot]);
  });

  test.each([
    ["amount", { amount: 80 }],
    ["date", { date: "2026-11-03" }],
    ["account", { accountId: "monzo" }],
  ])("editing a row's %s brings the pair back", (_, edit) => {
    const snapshot = snapshotOf(out, back);
    expect(liveDismissals([out, { ...back, ...edit }], [snapshot])).toEqual([]);
  });

  test("a dismissal whose row is gone no longer applies", () => {
    expect(liveDismissals([out], [snapshotOf(out, back)])).toEqual([]);
  });

  test("hidden pairs read like the pairs they hid", () => {
    expect(hiddenPairs([back, out], [snapshotOf(out, back)])).toEqual([
      {
        outId: "a",
        inId: "b",
        amount: 75,
        daysApart: 1,
        earlierDate: "2026-11-01",
        otherMatches: 0,
        isTaggedElsewhere: false,
      },
    ]);
  });
});

describe("labels", () => {
  test.each([
    [0, "same day"],
    [1, "1 day apart"],
    [3, "3 days apart"],
  ])("%i days reads as %s", (days, label) => {
    expect(daysApartLabel(days)).toBe(label);
  });

  const pair = {
    outId: "a",
    inId: "b",
    amount: 20,
    daysApart: 0,
    earlierDate: "2026-11-12",
    otherMatches: 0,
    isTaggedElsewhere: false,
  };

  test("a clean pair has no warnings", () => {
    expect(pairWarnings(pair)).toEqual([]);
  });

  test("rivals and a stray tag each say so", () => {
    expect(pairWarnings({ ...pair, otherMatches: 1 })).toEqual([
      "1 other row could also match",
    ]);
    expect(
      pairWarnings({ ...pair, otherMatches: 2, isTaggedElsewhere: true }),
    ).toEqual([
      "2 other rows could also match",
      "Tagged to a different account",
    ]);
  });
});
