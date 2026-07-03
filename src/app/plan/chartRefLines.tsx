// src/app/plan/chartRefLines.tsx
import { ReferenceLine } from "recharts";
import type { DefaultTheme } from "styled-components";

// Vertical retirement / state-pension marker lines shared by all three plan
// charts, mirroring the Timeline's ref lines so the panels read as one system.
// Returns an array of <ReferenceLine> elements rather than a wrapper component:
// Recharts flattens child arrays and inspects each element's type, but would not
// recognise a custom component here. Ages outside the plotted range (or a null
// state-pension age) are dropped — a discarded reference line just wouldn't draw.
export function ageReferenceLines({
  retirementAge,
  statePensionAge,
  minAge,
  maxAge,
  theme,
}: {
  retirementAge: number;
  statePensionAge: number | null;
  minAge: number;
  maxAge: number;
  theme: DefaultTheme;
}) {
  const inRange = (age: number | null): age is number =>
    age !== null && age >= minAge && age <= maxAge;

  const marks: { label: string; age: number }[] = [];
  if (inRange(retirementAge))
    marks.push({ label: "Retirement", age: retirementAge });
  if (inRange(statePensionAge))
    marks.push({ label: "State pension", age: statePensionAge });

  return marks.map(({ label, age }, i) => (
    <ReferenceLine
      key={label}
      x={age}
      stroke={theme.colors.hairlineStrong}
      strokeDasharray="4 3"
      label={{
        value: label,
        // Horizontal, and staggered top vs bottom: retirement and state pension
        // are often only a couple of years apart, so alternating vertical ends
        // keeps the two labels from colliding. Horizontal also avoids the
        // clipping a rotated label suffered against the chart's small top margin.
        position: i % 2 === 0 ? "insideTopLeft" : "insideBottomLeft",
        fontSize: 10,
        fill: theme.colors.dim,
      }}
    />
  ));
}
