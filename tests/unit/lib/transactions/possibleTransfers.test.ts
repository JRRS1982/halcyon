import {
  approveAllOffer,
  approveNotice,
  beforeTags,
  daysApartLabel,
  dismissNotice,
  hiddenPairs,
  isEligibleForApproveAll,
  isMarkedAsTransfer,
  isMatch,
  liveDismissals,
  markNotice,
  type PairCandidate,
  pairKey,
  pairPossibleTransfers,
  pairWarnings,
  snapshotOf,
  transferSuggestion,
  transferTags,
  UNTAGGED,
  withdrawNotice,
  withHeldPairs,
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

  test("a row hidden in two pairs is listed once, in the first pair the list shows", () => {
    // Hide A–B, A then pairs with C, hide A–C: listing both would show A twice.
    const later = row("c", "2026-11-03", 75, "monzo");
    const shown = hiddenPairs(
      [out, back, later],
      [snapshotOf(out, back), snapshotOf(out, later)],
    );
    expect(shown.map((p) => [p.outId, p.inId])).toEqual([["a", "b"]]);
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

describe("what the ledger says after a pair action", () => {
  test("hiding says how many pairs went", () => {
    expect(dismissNotice(1, 0)).toBe("Hid 1 pair: not a transfer.");
    expect(dismissNotice(3, 0)).toBe("Hid 3 pairs: not a transfer.");
  });

  test("a pair that no longer matched is owned up to, not dropped", () => {
    expect(dismissNotice(1, 1)).toBe(
      "Hid 1 pair: not a transfer. 1 pair no longer matched, so it is still listed.",
    );
    expect(dismissNotice(0, 2)).toBe(
      "2 pairs no longer matched, so they are still listed.",
    );
  });

  test("marking says nothing when every pair was marked", () => {
    expect(markNotice(0)).toBeNull();
  });

  test("marking says which pairs were left alone, and why", () => {
    expect(markNotice(1)).toBe(
      "1 pair was not marked: it no longer matches, or one side is in an archived account.",
    );
    expect(markNotice(2)).toBe(
      "2 pairs were not marked: they no longer match, or one side is in an archived account.",
    );
  });
});

describe("the transfer a pair suggests for a row", () => {
  const leg = (
    amount: number,
    accountId: string,
    accountName: string,
    tag: { categoryId?: string; transferAccountId?: string } = {},
  ) => ({
    amount,
    accountId,
    accountName,
    categoryId: tag.categoryId ?? null,
    transferAccountId: tag.transferAccountId ?? null,
  });
  const out = leg(-200, "cur", "Current");
  const into = leg(200, "sav", "Savings");

  test("money out is a transfer to the other row's account", () => {
    expect(transferSuggestion(out, into)).toBe("Transfer to Savings");
  });

  test("money in is a transfer from the other row's account", () => {
    expect(transferSuggestion(into, out)).toBe("Transfer from Current");
  });

  test("a row that has a category keeps it: nothing is suggested over it", () => {
    expect(
      transferSuggestion(
        leg(-200, "cur", "Current", { categoryId: "c" }),
        into,
      ),
    ).toBeNull();
  });

  test("a row already tagged as a transfer keeps that too", () => {
    expect(
      transferSuggestion(
        leg(-200, "cur", "Current", { transferAccountId: "isa" }),
        into,
      ),
    ).toBeNull();
  });
});

describe("whether a pair is marked as a transfer", () => {
  const side = (id: string, accountId: string, transferAccountId?: string) => ({
    id,
    accountId,
    transferAccountId: transferAccountId ?? null,
  });

  test("it is when each row points at the other row's account", () => {
    expect(
      isMarkedAsTransfer(side("a", "cur", "sav"), side("b", "sav", "cur")),
    ).toBe(true);
  });

  test.each([
    ["only one row is tagged", side("a", "cur", "sav"), side("b", "sav")],
    ["neither is", side("a", "cur"), side("b", "sav")],
    [
      "one points at a third account",
      side("a", "cur", "isa"),
      side("b", "sav", "cur"),
    ],
  ])("it is not when %s", (_, out, into) => {
    expect(isMarkedAsTransfer(out, into)).toBe(false);
  });

  test("marking tags each row with the other's account, approved", () => {
    expect(transferTags(side("a", "cur"), side("b", "sav"))).toEqual([
      {
        id: "a",
        transferAccountId: "sav",
        categoryId: null,
        isCategoryConfirmed: true,
      },
      {
        id: "b",
        transferAccountId: "cur",
        categoryId: null,
        isCategoryConfirmed: true,
      },
    ]);
  });

  test("withdrawing puts back what each row held before", () => {
    const pencilled = {
      categoryId: "c",
      transferAccountId: null,
      isCategoryConfirmed: false,
    };
    expect(
      beforeTags({
        outId: "a",
        inId: "b",
        outBefore: UNTAGGED,
        inBefore: pencilled,
      }),
    ).toEqual([
      { id: "a", ...UNTAGGED },
      { id: "b", ...pencilled },
    ]);
  });
});

describe("Approve all", () => {
  const flags = { otherMatches: 0, isTaggedElsewhere: false };

  test("takes a pair with nothing to check", () => {
    expect(isEligibleForApproveAll(flags)).toBe(true);
  });

  test("leaves a pair another row could also match", () => {
    expect(isEligibleForApproveAll({ ...flags, otherMatches: 1 })).toBe(false);
  });

  test("leaves a pair tagged to a different account", () => {
    expect(isEligibleForApproveAll({ ...flags, isTaggedElsewhere: true })).toBe(
      false,
    );
  });

  const pair = (
    id: string,
    state: { isEligible?: boolean; isApproved?: boolean; isHeld?: boolean },
  ) => ({ id, isEligible: true, isApproved: false, isHeld: false, ...state });

  test("offers to approve the eligible pairs not yet approved", () => {
    const offer = approveAllOffer([
      pair("a", {}),
      pair("b", { isApproved: true, isHeld: true }),
      pair("warned", { isEligible: false }),
    ]);
    expect(offer?.action).toBe("approve");
    expect(offer?.pairs.map((p) => p.id)).toEqual(["a"]);
  });

  test("with none left, offers to withdraw the ones this view approved", () => {
    const offer = approveAllOffer([
      pair("a", { isApproved: true, isHeld: true }),
      pair("b", { isApproved: true, isHeld: true }),
      pair("warned", { isEligible: false }),
    ]);
    expect(offer?.action).toBe("withdraw");
    expect(offer?.pairs.map((p) => p.id)).toEqual(["a", "b"]);
  });

  // One click must never untag a page of transfers made long ago.
  test("never offers to withdraw a pair tagged before this view", () => {
    const offer = approveAllOffer([
      pair("old", { isApproved: true }),
      pair("new", { isApproved: true, isHeld: true }),
    ]);
    expect(offer?.pairs.map((p) => p.id)).toEqual(["new"]);
    expect(approveAllOffer([pair("old", { isApproved: true })])).toBeNull();
  });

  test("a warned pair approved by hand is not part of all", () => {
    expect(
      approveAllOffer([
        pair("warned", { isEligible: false, isApproved: true, isHeld: true }),
      ]),
    ).toBeNull();
  });

  test("offers nothing when every pair has a warning", () => {
    expect(approveAllOffer([pair("warned", { isEligible: false })])).toBeNull();
  });
});

describe("pairs kept on screen after the page stops listing them", () => {
  const pair = (outId: string, earlierDate: string) => ({
    outId,
    inId: `${outId}-in`,
    amount: 20,
    daysApart: 0,
    earlierDate,
    otherMatches: 0,
    isTaggedElsewhere: false,
  });
  const newest = pair("a", "2026-11-12");
  const middle = pair("b", "2026-11-08");
  const oldest = pair("c", "2026-11-01");

  test("a held pair the page dropped keeps its place by date", () => {
    expect(
      withHeldPairs([newest, oldest], [middle]).map((p) => p.outId),
    ).toEqual(["a", "b", "c"]);
  });

  test("a pair the page still lists is shown once, as the page has it", () => {
    const fresh = { ...middle, otherMatches: 2 };
    expect(withHeldPairs([fresh], [middle])).toEqual([fresh]);
  });
});

describe("what the ledger says after approving or withdrawing", () => {
  test("one pair approved", () => {
    expect(approveNotice(1, 0, 0)).toBe("Both rows marked as a transfer.");
  });

  test("several approved, with the warned pairs left", () => {
    expect(approveNotice(3, 0, 0)).toBe("3 pairs marked as transfers.");
    expect(approveNotice(3, 1, 0)).toBe(
      "3 pairs marked as transfers; 1 with a warning left for you.",
    );
    expect(approveNotice(1, 2, 0)).toBe(
      "1 pair marked as a transfer; 2 with a warning left for you.",
    );
  });

  test("a pair the server would not mark is owned up to", () => {
    expect(approveNotice(2, 0, 1)).toBe(
      "2 pairs marked as transfers. 1 pair was not marked: it no longer matches, or one side is in an archived account.",
    );
    expect(approveNotice(0, 0, 1)).toBe(
      "1 pair was not marked: it no longer matches, or one side is in an archived account.",
    );
  });

  test("an approval withdrawn", () => {
    expect(withdrawNotice(1, 0)).toBe(
      "Approval withdrawn: both rows are as they were.",
    );
    expect(withdrawNotice(3, 0)).toBe(
      "Approval withdrawn from 3 pairs: their rows are as they were.",
    );
  });

  test("a pair changed since it was approved is left alone, and says so", () => {
    expect(withdrawNotice(0, 1)).toBe(
      "1 pair was left as it is: its rows have changed since.",
    );
    expect(withdrawNotice(2, 2)).toBe(
      "Approval withdrawn from 2 pairs: their rows are as they were. 2 pairs were left as they are: their rows have changed since.",
    );
  });
});
