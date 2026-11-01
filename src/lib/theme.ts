// Theme object — the runtime form of DESIGN.md's frontmatter tokens.
// Keep this file in lockstep with /DESIGN.md; if a token here ever drifts
// from the doc, the doc wins and this file is wrong.

import { type ColorToken, cssVariableName } from "./palette";

// Two faces: an editorial serif for headlines, section rows and the big
// figures, and a sturdy grotesk for tables and controls. Both are loaded by
// next/font in the root layout and reached through these variables.
const SANS =
  "var(--font-sans), system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "var(--font-serif), Georgia, 'Times New Roman', serif";

// Colours resolve to CSS custom properties rather than to literal hex, so a
// single set of styled components serves both schemes and the browser does the
// switching. The values behind these live in palette.ts, and which set applies
// is decided by a `data-theme` attribute the server writes onto <html> — so the
// correct scheme is painted on the first frame instead of flashing white and
// correcting itself.
//
// Practical consequence: `theme.colors.canvas` is the string "var(--c-canvas)",
// not "#FFFFFF". Anything that needs a real value (contrast maths, a canvas
// element, a colour comparison) must import the palette directly.
const cssVar = (token: ColorToken) => `var(${cssVariableName(token)})`;

export const theme = {
  colors: {
    primary: cssVar("primary"),
    onPrimary: cssVar("onPrimary"),
    ink: cssVar("ink"),
    inkSoft: cssVar("inkSoft"),
    body: cssVar("body"),
    bodyMuted: cssVar("bodyMuted"),
    dim: cssVar("dim"),
    hairline: cssVar("hairline"),
    hairlineStrong: cssVar("hairlineStrong"),
    canvas: cssVar("canvas"),
    canvasSoft: cssVar("canvasSoft"),
    field: cssVar("field"),
    fieldBorder: cssVar("fieldBorder"),
    // The sheet's section strips and the marketing bands. Named for the job
    // because the colour inverts between schemes — see palette.ts.
    band: cssVar("band"),
    bandSoft: cssVar("bandSoft"),
    onBand: cssVar("onBand"),
    bodyOnBand: cssVar("bodyOnBand"),
    hairlineBand: cssVar("hairlineBand"),
    positive: cssVar("positive"),
    negative: cssVar("negative"),
    focus: cssVar("focus"),
    // The single highlight accent. Used sparingly — period dates in eyebrows,
    // selected rows, anything the user should locate at a glance.
    accent: cssVar("accent"),
    chartRate: cssVar("chartRate"),
    chartBudget: cssVar("chartBudget"),
    chartCash: cssVar("chartCash"),
    chartIsa: cssVar("chartIsa"),
    chartGia: cssVar("chartGia"),
    chartProperty: cssVar("chartProperty"),
    chartOtherAsset: cssVar("chartOtherAsset"),
    chartPension: cssVar("chartPension"),
    chartDbPension: cssVar("chartDbPension"),
    sectionFixed: cssVar("sectionFixed"),
    sectionVariable: cssVar("sectionVariable"),
    sectionDiscretionary: cssVar("sectionDiscretionary"),
  },

  // The type tokens. See DESIGN.md → Typography → Hierarchy for the scale.
  typography: {
    displayXl: {
      family: SERIF,
      size: "32px",
      weight: 700,
      lineHeight: 1.12,
      letterSpacing: "-0.01em",
    },
    displayLg: {
      family: SERIF,
      size: "20px",
      weight: 700,
      lineHeight: 1.25,
      letterSpacing: "-0.005em",
    },
    bodyMd: {
      family: SANS,
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    bodyMdStrong: {
      family: SANS,
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    amount: {
      family: SANS,
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountStrong: {
      family: SANS,
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountXl: {
      family: SERIF,
      size: "20px",
      weight: 700,
      lineHeight: 1.25,
      letterSpacing: "0",
    },
    // Buttons, toolbar tools, selects and table column heads: sentence case,
    // the one weight a control is set in everywhere.
    control: {
      family: SANS,
      size: "14px",
      weight: 600,
      lineHeight: 1.15,
      letterSpacing: "0",
    },
    kicker: {
      family: SANS,
      size: "12px",
      weight: 700,
      lineHeight: 1.2,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
    },
  },

  rounded: {
    none: "0px",
    sm: "2px",
    full: "9999px",
  },

  spacing: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "44px",
    "5xl": "48px",
    section: "80px",
  },
} as const;

export type Theme = typeof theme;
