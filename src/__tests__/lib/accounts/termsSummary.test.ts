import { summariseTerms } from "@/lib/accounts/termsSummary";

describe("summariseTerms", () => {
  it("names the default being accepted when nothing is typed", () => {
    expect(summariseTerms("STOCKS_ISA", {})).toBe("plan default growth");
  });

  it("states what was typed", () => {
    expect(
      summariseTerms("STOCKS_ISA", { expectedReturnPct: 5, feePct: 0.22 }),
    ).toBe("5% growth · 0.22% fee");
  });

  it("omits a zero fee rather than saying 0% fee", () => {
    expect(
      summariseTerms("STOCKS_ISA", { expectedReturnPct: 5, feePct: 0 }),
    ).toBe("5% growth");
  });

  it("summarises a debt by its rate", () => {
    expect(summariseTerms("MORTGAGE", { interestPct: 4.29 })).toBe(
      "4.29% interest",
    );
  });

  // A credit card prompts for one parameter — its rate — so an untouched
  // Advanced section states the 0% that not answering leaves it at, rather
  // than saying nothing.
  it("states the rate a debt falls back to when nothing is typed", () => {
    expect(summariseTerms("CREDIT_CARD", {})).toBe("0% interest");
  });
});
