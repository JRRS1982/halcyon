import type { AccountType } from "@prisma/client";
import { ACCOUNT_TYPES, termsFor } from "@/lib/accounts/accountDraft";

describe("accountTerms", () => {
  describe("TermField", () => {
    it("should have all nine term field names", () => {
      const expectedFields = [
        "expectedReturnPct",
        "feePct",
        "minAccessAge",
        "annualIncome",
        "interestPct",
        "interestOnly",
        "revisionDate",
        "revisionRate",
        "endDate",
      ];
      expect(expectedFields).toHaveLength(9);
    });
  });

  describe("AccountTypeOption.terms", () => {
    it("every account type should have a terms array", () => {
      for (const option of ACCOUNT_TYPES) {
        expect(option.terms).toBeDefined();
        expect(Array.isArray(option.terms)).toBe(true);
      }
    });

    it("should map account types to correct term fields", () => {
      const typeToTerms = new Map<AccountType, readonly string[]>(
        ACCOUNT_TYPES.map((t) => [t.id, t.terms as readonly string[]]),
      );

      expect(typeToTerms.get("CURRENT_ACCOUNT")).toEqual(["expectedReturnPct"]);
      expect(typeToTerms.get("SAVINGS")).toEqual(["expectedReturnPct"]);
      expect(typeToTerms.get("CASH_ISA")).toEqual(["expectedReturnPct"]);

      expect(typeToTerms.get("STOCKS_ISA")).toEqual([
        "expectedReturnPct",
        "feePct",
      ]);
      expect(typeToTerms.get("GIA")).toEqual(["expectedReturnPct", "feePct"]);
      expect(typeToTerms.get("OTHER_ASSET")).toEqual([
        "expectedReturnPct",
        "feePct",
      ]);

      expect(typeToTerms.get("SIPP")).toEqual([
        "expectedReturnPct",
        "feePct",
        "minAccessAge",
      ]);

      expect(typeToTerms.get("PROPERTY")).toEqual(["expectedReturnPct"]);

      expect(typeToTerms.get("FINAL_SALARY")).toEqual([
        "annualIncome",
        "endDate",
      ]);

      expect(typeToTerms.get("MORTGAGE")).toEqual([
        "interestPct",
        "interestOnly",
        "revisionDate",
        "revisionRate",
        "endDate",
      ]);

      expect(typeToTerms.get("LOAN")).toEqual([
        "interestPct",
        "revisionDate",
        "revisionRate",
        "endDate",
      ]);
      expect(typeToTerms.get("OTHER_DEBT")).toEqual([
        "interestPct",
        "revisionDate",
        "revisionRate",
        "endDate",
      ]);

      expect(typeToTerms.get("CREDIT_CARD")).toEqual(["interestPct"]);
      expect(typeToTerms.get("OVERDRAFT")).toEqual(["interestPct"]);
    });
  });

  describe("termsFor()", () => {
    it("should return terms for a given account type", () => {
      expect(termsFor("CURRENT_ACCOUNT")).toEqual(["expectedReturnPct"]);
      expect(termsFor("SIPP")).toEqual([
        "expectedReturnPct",
        "feePct",
        "minAccessAge",
      ]);
      expect(termsFor("MORTGAGE")).toEqual([
        "interestPct",
        "interestOnly",
        "revisionDate",
        "revisionRate",
        "endDate",
      ]);
    });

    it("should return all nine types when checking the complete set", () => {
      const allTerms = new Set<string>();
      for (const option of ACCOUNT_TYPES) {
        for (const term of option.terms as readonly string[]) {
          allTerms.add(term);
        }
      }
      expect(allTerms).toEqual(
        new Set([
          "expectedReturnPct",
          "feePct",
          "minAccessAge",
          "annualIncome",
          "interestPct",
          "interestOnly",
          "revisionDate",
          "revisionRate",
          "endDate",
        ]),
      );
    });
  });
});
