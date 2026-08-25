import {
  type MortgageLinkCandidate,
  resolveMortgageLinks,
} from "@/lib/accounts/mortgageLinks";

const candidate = (
  overrides: Partial<MortgageLinkCandidate> = {},
): MortgageLinkCandidate => ({
  liabilityAccountId: "liability-1",
  liabilityAccountLinkedAccountId: null,
  propertyAccountId: "property-1",
  ...overrides,
});

describe("resolveMortgageLinks", () => {
  test("links a candidate whose liability account has no link yet", () => {
    const links = resolveMortgageLinks([candidate()], new Set());
    expect(links).toEqual([
      { liabilityAccountId: "liability-1", propertyAccountId: "property-1" },
    ]);
  });

  test("never overwrites a liability account that already has a link", () => {
    const links = resolveMortgageLinks(
      [candidate({ liabilityAccountLinkedAccountId: "some-other-property" })],
      new Set(),
    );
    expect(links).toEqual([]);
  });

  test("skips a candidate whose property is already claimed elsewhere", () => {
    const links = resolveMortgageLinks(
      [candidate({ propertyAccountId: "property-1" })],
      new Set(["property-1"]),
    );
    expect(links).toEqual([]);
  });

  test("lets only the first of two liabilities claim the same property", () => {
    const links = resolveMortgageLinks(
      [
        candidate({ liabilityAccountId: "liability-a" }),
        candidate({ liabilityAccountId: "liability-b" }),
      ],
      new Set(),
    );
    expect(links).toEqual([
      { liabilityAccountId: "liability-a", propertyAccountId: "property-1" },
    ]);
  });

  test("lets only the first pairing for one liability account through, even against different properties", () => {
    const links = resolveMortgageLinks(
      [
        candidate({ propertyAccountId: "property-a" }),
        candidate({ propertyAccountId: "property-b" }),
      ],
      new Set(),
    );
    expect(links).toEqual([
      { liabilityAccountId: "liability-1", propertyAccountId: "property-a" },
    ]);
  });
});
