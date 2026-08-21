import {
  accountIdsForDeletion,
  deletionRefusalMessage,
} from "@/lib/accounts/deletion";

describe("accountIdsForDeletion", () => {
  test("no partner yields just the one id", () => {
    expect(accountIdsForDeletion("acc-1", null)).toEqual(["acc-1"]);
  });

  test("a resolved partner yields both ids", () => {
    expect(accountIdsForDeletion("acc-1", "acc-2")).toEqual(["acc-1", "acc-2"]);
  });

  test("alsoLinked with no resolvable partner still yields one id", () => {
    // Mirrors the caller asking to take the linked account too, but
    // resolveLinkedPartnerId coming back empty (no link exists, or it
    // couldn't be verified as the caller's own) — the partner argument is
    // null either way, and the id list must not include a stray id.
    expect(accountIdsForDeletion("acc-1", null)).toEqual(["acc-1"]);
  });
});

describe("deletionRefusalMessage", () => {
  test("no blocking transfers means proceed", () => {
    expect(deletionRefusalMessage(0)).toBeNull();
  });

  test("any blocking transfer refuses with the confirmation-panel message", () => {
    expect(deletionRefusalMessage(1)).toBe(
      "This account still has transactions. Reassign or remove them first.",
    );
  });

  test("more than one blocking transfer refuses with the same message", () => {
    expect(deletionRefusalMessage(5)).toBe(
      "This account still has transactions. Reassign or remove them first.",
    );
  });
});
