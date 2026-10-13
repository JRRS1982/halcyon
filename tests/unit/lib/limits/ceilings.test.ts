import {
  assertRoom,
  STORED_CEILING_MULTIPLE,
  storedCeilingFor,
} from "@/lib/limits/ceilings";

const liveError = () => new Error("sheet full");

const check = (live: number, stored: number, adding = 1) =>
  assertRoom({
    countLive: async () => live,
    countStored: async () => stored,
    liveMax: 10,
    liveError,
    adding,
  });

describe("assertRoom", () => {
  it("allows a write with room under both ceilings", async () => {
    await expect(check(5, 20)).resolves.toBeUndefined();
  });

  it("reports the visible ceiling in the user's terms", async () => {
    await expect(check(10, 20)).rejects.toThrow("sheet full");
  });

  // The defect both ceilings exist for: deleting frees a display slot, so a
  // create/delete loop sits at live=0 forever while the table grows.
  it("stops a create-delete loop that the live count cannot see", async () => {
    await expect(check(0, storedCeilingFor(10))).rejects.toThrow(
      /created and deleted too many times/,
    );
  });

  it("leaves ordinary deleting alone", async () => {
    // Ten times the live ceiling in tombstones is far past any real use.
    await expect(check(3, storedCeilingFor(10) - 1)).resolves.toBeUndefined();
  });

  it("counts the whole batch, not one row", async () => {
    await expect(check(0, 0, 11)).rejects.toThrow("sheet full");
    await expect(check(0, storedCeilingFor(10) - 5, 6)).rejects.toThrow(
      /created and deleted/,
    );
  });

  it("keeps the stored ceiling above the live one", () => {
    expect(STORED_CEILING_MULTIPLE).toBeGreaterThan(1);
    expect(storedCeilingFor(500)).toBe(5000);
  });
});
