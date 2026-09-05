import {
  ageOnDate,
  emptyRowTerms,
  rowTermsEqual,
  TERM_COMPARE_KEYS,
} from "@/lib/plan/rowTerms";

describe("ageOnDate", () => {
  const dob = new Date("1984-03-01");

  it("converts a date to the age reached in that calendar year", () => {
    expect(ageOnDate(dob, new Date("2049-06-01"))).toBe(65);
  });

  it("returns null for no date, so an unset term stays unset", () => {
    expect(ageOnDate(dob, null)).toBeNull();
  });
});

describe("rowTermsEqual", () => {
  it("is true for two empty sets", () => {
    expect(rowTermsEqual(emptyRowTerms(), emptyRowTerms())).toBe(true);
  });

  it("compares every key it declares", () => {
    // The guard against the real bug: a term added to RowTerms but forgotten
    // in the comparison would let a changed rate report as "up to date".
    for (const key of TERM_COMPARE_KEYS) {
      const a = emptyRowTerms();
      const b = {
        ...emptyRowTerms(),
        [key]: key === "interestOnly" ? true : 1,
      };
      expect(rowTermsEqual(a, b)).toBe(false);
    }
  });

  it("compares ages, not dates — a date would never equal an age", () => {
    expect(TERM_COMPARE_KEYS).toContain("endAge");
    expect(TERM_COMPARE_KEYS).not.toContain("endDate");
  });
});
