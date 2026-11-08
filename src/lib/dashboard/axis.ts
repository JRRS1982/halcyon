import { type AmountAxis, niceStep } from "@/lib/charts/format";

// The Y axis for a per-category chart, fitted to the user's own figures.
//
// Recharts starts a numeric axis at zero, which squashes a line living in a
// narrow band against the top, so the range is padded 10% beyond the data. The
// padding is a tenth of each value's magnitude, not of the range: a £172k
// mortgage that fell £2k stays nearly flat instead of filling the chart as a
// cliff. Gridlines then land on a round step across that padded range, so they
// read £200, £400… rather than the £342, £542… a padded domain left to Recharts
// produced. Figures that never go below zero never get a negative floor.
export function fittedAxis(values: readonly number[]): AmountAxis {
  const finite = values.filter(Number.isFinite);
  const min = finite.length > 0 ? Math.min(...finite) : 0;
  const max = finite.length > 0 ? Math.max(...finite) : 0;
  const low = min - Math.abs(min) * 0.1;
  const high = max + Math.abs(max) * 0.1;
  if (high === low) return { domain: [0, 100], ticks: [0, 50, 100] };

  const step = niceStep(low, high);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const count = Math.round((end - start) / step);
  // toFixed strips the float residue a sub-unit step leaves (0.30000000000000004).
  const ticks = Array.from({ length: count + 1 }, (_, i) =>
    Number((start + i * step).toFixed(10)),
  );
  return { domain: [start, end], ticks };
}
