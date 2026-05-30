import {
  PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  sliceForCursor,
} from "@/lib/transactions/pagination";

const row = (id: string, iso: string) => ({ id, date: new Date(iso) });

describe("cursor encoding", () => {
  test("encode → decode round-trips date and id", () => {
    const cursor = encodeCursor({
      id: "tx-1",
      date: new Date("2026-03-14T00:00:00Z"),
    });
    const decoded = decodeCursor(cursor);
    expect(decoded?.id).toBe("tx-1");
    expect(decoded?.date.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  test("decode returns null for malformed cursors", () => {
    expect(decodeCursor("garbage")).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("sliceForCursor", () => {
  test("returns all rows and no next cursor when below the limit", () => {
    const rows = [
      row("a", "2026-03-03T00:00:00Z"),
      row("b", "2026-03-02T00:00:00Z"),
    ];
    const page = sliceForCursor(rows, 5);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  test("trims the probe row and emits a next cursor when there are more", () => {
    // limit 2, but 3 rows fetched (limit + 1 probe) → more pages exist
    const rows = [
      row("a", "2026-03-03T00:00:00Z"),
      row("b", "2026-03-02T00:00:00Z"),
      row("c", "2026-03-01T00:00:00Z"),
    ];
    const page = sliceForCursor(rows, 2);
    expect(page.items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(decodeCursor(page.nextCursor as string)?.id).toBe("b");
  });

  test("exactly limit rows means no next page", () => {
    const rows = [
      row("a", "2026-03-03T00:00:00Z"),
      row("b", "2026-03-02T00:00:00Z"),
    ];
    expect(sliceForCursor(rows, 2).nextCursor).toBeNull();
  });

  test("exposes a default page size", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});
