import { isSeedableAuthProject } from "@/lib/auth/demo";

// If this is wrong, `pnpm db:seed` with a production Supabase URL creates
// demo@halcyon.local — password published in this public repo — in production
// auth, and the ordinary sign-in form accepts it.
describe("isSeedableAuthProject", () => {
  it("allows the dev project", () => {
    expect(
      isSeedableAuthProject("https://cxoefsvzkyswzbtztchj.supabase.co"),
    ).toBe(true);
  });

  it("refuses an unlisted project, which is how production is excluded", () => {
    expect(
      isSeedableAuthProject("https://dypeutyzekssvllzlbam.supabase.co"),
    ).toBe(false);
    expect(isSeedableAuthProject("https://anything-else.supabase.co")).toBe(
      false,
    );
  });

  it("allows a local stack so offline development still works", () => {
    expect(isSeedableAuthProject("http://localhost:54321")).toBe(true);
    expect(isSeedableAuthProject("http://127.0.0.1:54321")).toBe(true);
  });

  // Fails closed on anything it cannot read, rather than assuming the best.
  it("refuses an unset or unparseable value", () => {
    expect(isSeedableAuthProject(undefined)).toBe(false);
    expect(isSeedableAuthProject("")).toBe(false);
    expect(isSeedableAuthProject("not a url")).toBe(false);
  });
});
