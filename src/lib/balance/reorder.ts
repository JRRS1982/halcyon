export type BalanceType = "ASSET" | "LIABILITY";
export type BalanceCategory =
  | "CURRENT"
  | "MEDIUM_TERM"
  | "LONG_TERM"
  | "PROPERTY"
  | "OTHER";

// Buckets in top-to-bottom display order. Move up/down walks this list one
// boundary at a time, so a row can cross from the top of its bucket into the
// (possibly empty) bucket above it, and vice versa. LIABILITY:PROPERTY is
// included so the algorithm stays robust if such a row ever exists, but the
// UI never surfaces a Liabilities · Property section.
export const BUCKET_ORDER: { type: BalanceType; category: BalanceCategory }[] =
  [
    { type: "ASSET", category: "CURRENT" },
    { type: "ASSET", category: "MEDIUM_TERM" },
    { type: "ASSET", category: "LONG_TERM" },
    { type: "ASSET", category: "PROPERTY" },
    { type: "ASSET", category: "OTHER" },
    { type: "LIABILITY", category: "CURRENT" },
    { type: "LIABILITY", category: "MEDIUM_TERM" },
    { type: "LIABILITY", category: "LONG_TERM" },
    { type: "LIABILITY", category: "PROPERTY" },
    { type: "LIABILITY", category: "OTHER" },
  ];

function bucketIndex(type: BalanceType, category: BalanceCategory): number {
  return BUCKET_ORDER.findIndex(
    (b) => b.type === type && b.category === category,
  );
}

// Minimal shape the move algorithm needs. Works for both the client's
// SerializedBalanceItem and the server's Prisma rows.
export type Movable = {
  id: string;
  type: BalanceType;
  category: BalanceCategory;
  sortOrder: number;
};

// Returns a new array with the moved row (and, for an in-bucket swap, its
// neighbour) updated — only type / category / sortOrder change. Returns null
// when the move is a no-op (item already at the very top / bottom, or not
// found). The caller diffs against the input to learn what to persist.
export function computeMove<T extends Movable>(
  items: T[],
  itemId: string,
  direction: "up" | "down",
): T[] | null {
  const target = items.find((it) => it.id === itemId);
  if (!target) return null;

  // Sorted rows within the target's bucket.
  const bucketRows = items
    .filter((it) => it.type === target.type && it.category === target.category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const p = bucketRows.findIndex((it) => it.id === itemId);
  const b = bucketIndex(target.type, target.category);

  const apply = (id: string, patch: Partial<Movable>): T[] =>
    items.map((it) => (it.id === id ? { ...it, ...patch } : it));

  const swap = (a: T, c: T): T[] =>
    items.map((it) => {
      if (it.id === a.id) return { ...it, sortOrder: c.sortOrder };
      if (it.id === c.id) return { ...it, sortOrder: a.sortOrder };
      return it;
    });

  if (direction === "up") {
    const above = bucketRows[p - 1];
    if (above) return swap(target, above);
    if (b <= 0) return null;
    // Move to the end of the previous bucket.
    const dest = BUCKET_ORDER[b - 1];
    if (!dest) return null;
    const destMax = Math.max(
      0,
      ...items
        .filter((it) => it.type === dest.type && it.category === dest.category)
        .map((it) => it.sortOrder),
    );
    return apply(itemId, {
      type: dest.type,
      category: dest.category,
      sortOrder: destMax + 1,
    });
  }

  // direction === "down"
  const below = bucketRows[p + 1];
  if (below) return swap(target, below);
  if (b >= BUCKET_ORDER.length - 1) return null;
  // Move to the start of the next bucket.
  const dest = BUCKET_ORDER[b + 1];
  if (!dest) return null;
  const destMin = Math.min(
    0,
    ...items
      .filter((it) => it.type === dest.type && it.category === dest.category)
      .map((it) => it.sortOrder),
  );
  return apply(itemId, {
    type: dest.type,
    category: dest.category,
    sortOrder: destMin - 1,
  });
}

// Whether a move in the given direction would do anything. Used to disable
// the toolbar buttons at the extremes.
export function canMove<T extends Movable>(
  items: T[],
  itemId: string,
  direction: "up" | "down",
): boolean {
  return computeMove(items, itemId, direction) !== null;
}
