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
  expectedDeathAge,
  liquidDepletionAge,
  minAge,
  maxAge,
  theme,
}: {
  retirementAge: number;
  statePensionAge: number | null;
  expectedDeathAge: number | null;
  liquidDepletionAge: number | null;
  minAge: number;
  maxAge: number;
  theme: DefaultTheme;
}) {
  const inRange = (age: number | null): age is number =>
    age !== null && age >= minAge && age <= maxAge;

  // `emphasis` marks draw solid + coloured (the pots-depleted line is an
  // important moment); the rest are recessive dashed grey.
  const marks: { label: string; age: number; emphasis?: string }[] = [];
  if (inRange(retirementAge))
    marks.push({ label: "Retirement", age: retirementAge });
  if (inRange(statePensionAge))
    marks.push({ label: "State pension", age: statePensionAge });
  if (inRange(expectedDeathAge))
    marks.push({ label: "Life expectancy", age: expectedDeathAge });
  if (inRange(liquidDepletionAge))
    marks.push({
      label: "Pots depleted",
      age: liquidDepletionAge,
      emphasis: theme.colors.negative,
    });

  return marks.map(({ label, age, emphasis }, i) => (
    <ReferenceLine
      key={label}
      x={age}
      stroke={emphasis ?? theme.colors.hairlineStrong}
      strokeDasharray={emphasis ? undefined : "4 3"}
      strokeWidth={emphasis ? 1.5 : 1}
      label={{
        value: label,
        // Horizontal, and staggered top vs bottom: the marker ages are often
        // only a couple of years apart, so alternating vertical ends keeps the
        // labels from colliding. Horizontal also avoids the clipping a rotated
        // label suffered against the chart's small top margin.
        position: i % 2 === 0 ? "insideTopLeft" : "insideBottomLeft",
        fontSize: 10,
        fill: emphasis ?? theme.colors.dim,
      }}
    />
  ));
}
