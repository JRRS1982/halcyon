// Per-bound Y-axis domain helpers for the per-category charts. Recharts defaults
// a numeric axis to start at zero, which squashes a line that lives in a narrow
// band against the top. These pad the axis 10% beyond the data's min/max so the
// line uses the full height. Padding by magnitude keeps it sign-safe; a zero
// bound stays at zero so a category that touches zero still anchors there.

export const padAxisMin = (dataMin: number): number =>
  Math.floor(dataMin - Math.abs(dataMin) * 0.1);

export const padAxisMax = (dataMax: number): number =>
  Math.ceil(dataMax + Math.abs(dataMax) * 0.1);
