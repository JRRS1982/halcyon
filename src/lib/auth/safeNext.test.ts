import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it.each(["/dashboard", "/budget?ym=2026-03", "/plan#assets", "/"])(
    "allows in-app path %s",
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    ["//evil.com", "protocol-relative"],
    ["/\\evil.com", "backslash (normalised to //)"],
    ["/\\/evil.com", "backslash variant"],
    ["https://evil.com", "absolute url"],
    ["http://evil.com", "absolute url"],
    ["@evil.com", "authority-escape via userinfo"],
    [".evil.com", "authority-escape via suffix"],
    ["evil.com", "no leading slash"],
    ["", "empty"],
  ])("rejects %s (%s) → '/'", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("rejects non-string input", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(new File([], "x"))).toBe("/");
  });

  it("honours a custom fallback", () => {
    expect(safeNext("//evil.com", "/sign-in")).toBe("/sign-in");
  });
});
