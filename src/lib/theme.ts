// Theme object — the runtime form of DESIGN.md's frontmatter tokens.
// Keep this file in lockstep with /DESIGN.md; if a token here ever drifts
// from the doc, the doc wins and this file is wrong.

import { type ColorToken, cssVariableName } from "./palette";

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
  },

  // Five sizes only. See DESIGN.md → Typography → Hierarchy.
  typography: {
    displayXl: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "28px",
      weight: 500,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
    },
    displayLg: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "18px",
      weight: 500,
      lineHeight: 1.3,
      letterSpacing: "-0.012em",
    },
    bodyMd: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    bodyMdStrong: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    amount: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountStrong: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountXl: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "18px",
      weight: 500,
      lineHeight: 1.3,
      letterSpacing: "-0.012em",
    },
    monoCaps: {
      family: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      size: "11px",
      weight: 500,
      lineHeight: 1.2,
      letterSpacing: "0.055em",
      textTransform: "uppercase" as const,
    },
  },

  rounded: {
    none: "0px",
    sm: "4px",
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
