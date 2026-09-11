import type { ColorToken } from "@/lib/palette";

// The swatch board's grouping. Every colour token is placed exactly once, and
// the map is total over ColorToken — so adding a colour to palette.ts fails
// typecheck here until it has been given a home on the page, rather than
// shipping a palette the design page silently omits.
const GROUPS = [
  {
    name: "brand",
    title: "Brand & interaction",
    blurb:
      "One black CTA and one muted blue. The blue owns interaction and wayfinding; it is never decorative.",
  },
  {
    name: "surface",
    title: "Surfaces",
    blurb:
      "A page is canvas end to end. Bands are the full-width strips that group sheet rows — named for the job because the colour inverts between schemes.",
  },
  {
    name: "text",
    title: "Text",
    blurb:
      "Every one of these clears 4.5:1 against the surfaces it is allowed on. Checked in contrast.test.ts, not by eye.",
  },
  {
    name: "line",
    title: "Lines",
    blurb:
      "Hairlines are the entire separation system — cards and panels never float on a shadow.",
  },
  {
    name: "sign",
    title: "Sign",
    blurb:
      "Applied to amounts only. Never a button fill, a badge background or a headline.",
  },
  {
    name: "chart",
    title: "Chart series",
    blurb:
      "Graphics rather than text, so these answer to the 3:1 non-text rule and to adjacent-pair separation under colour-vision deficiency.",
  },
] as const;

type GroupName = (typeof GROUPS)[number]["name"];

const groupOf: Record<ColorToken, GroupName> = {
  primary: "brand",
  onPrimary: "brand",
  accent: "brand",
  focus: "brand",

  canvas: "surface",
  canvasSoft: "surface",
  band: "surface",
  bandSoft: "surface",

  ink: "text",
  inkSoft: "text",
  body: "text",
  bodyMuted: "text",
  dim: "text",
  onBand: "text",
  bodyOnBand: "text",

  hairline: "line",
  hairlineStrong: "line",
  hairlineBand: "line",

  positive: "sign",
  negative: "sign",

  chartRate: "chart",
  chartBudget: "chart",
  chartCash: "chart",
  chartIsa: "chart",
  chartGia: "chart",
  chartProperty: "chart",
  chartOtherAsset: "chart",
  chartPension: "chart",
  chartDbPension: "chart",
};

export type SwatchGroup = {
  name: GroupName;
  title: string;
  blurb: string;
  tokens: ColorToken[];
};

/**
 * Groups in display order, each carrying its tokens in the order they are
 * declared above — which is the order palette.ts declares them, so the board
 * reads the same way the source does.
 */
export const swatchGroups = (): SwatchGroup[] => {
  const tokens = Object.keys(groupOf) as ColorToken[];

  return GROUPS.map(({ name, title, blurb }) => ({
    name,
    title,
    blurb,
    tokens: tokens.filter((token) => groupOf[token] === name),
  }));
};
