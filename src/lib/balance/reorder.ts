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

// PROPERTY is asset-only: mortgage debt files under Long-term liabilities
// instead (createAccountWithBalance hardcodes that — see
// accounts/creation.ts), so no UI surface should ever offer or render
// "Liabilities · Property". One definition shared by every place that
// builds a category picker (BalanceSheet.tsx's section dropdown and its own
// rendered subheads, AddAccountDrawer.tsx's Section field) rather than each
// re-stating the same filter.
export function isValidBalanceCategory(
  type: BalanceType,
  category: BalanceCategory,
): boolean {
  return !(type === "LIABILITY" && category === "PROPERTY");
}
