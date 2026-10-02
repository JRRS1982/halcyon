import { canConfirmDeletion, isPropertyRow } from "@/lib/accounts/deletion";

describe("isPropertyRow", () => {
  test("an ASSET in the PROPERTY category is the property side of a pair", () => {
    expect(isPropertyRow("ASSET", "PROPERTY")).toBe(true);
  });

  test("a LIABILITY is never the property side, even filed under PROPERTY", () => {
    expect(isPropertyRow("LIABILITY", "PROPERTY")).toBe(false);
  });

  test("an ASSET outside PROPERTY (e.g. an ISA) is not the property side", () => {
    expect(isPropertyRow("ASSET", "LONG_TERM")).toBe(false);
  });
});

describe("canConfirmDeletion", () => {
  test("stop tracking never requires confirmation text", () => {
    expect(canConfirmDeletion("archive", "")).toBe(true);
  });

  test("delete everywhere is blocked until DELETE is typed exactly", () => {
    expect(canConfirmDeletion("everywhere", "")).toBe(false);
    expect(canConfirmDeletion("everywhere", "delete")).toBe(false);
    expect(canConfirmDeletion("everywhere", "DELETE ")).toBe(false);
    expect(canConfirmDeletion("everywhere", "DELETE")).toBe(true);
  });
});
