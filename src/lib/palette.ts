// The two colour schemes, as raw values.
//
// Every styled component reads colours through `theme.colors`, which resolves
// to CSS custom properties (see theme.ts) rather than to hex. The actual values
// live here, and the mode is chosen by CSS — which is what lets the server
// decide the scheme and the page paint correctly on the very first frame,
// rather than flashing white and correcting itself after hydration.
//
// Keep in lockstep with /DESIGN.md; if a value here drifts from the doc, the
// doc wins and this file is wrong.

export type ColorToken =
  | "primary"
  | "onPrimary"
  | "ink"
  | "inkSoft"
  | "body"
  | "bodyMuted"
  | "dim"
  | "hairline"
  | "hairlineStrong"
  | "canvas"
  | "canvasSoft"
  | "band"
  | "bandSoft"
  | "onBand"
  | "bodyOnBand"
  | "hairlineBand"
  | "positive"
  | "negative"
  | "focus"
  | "accent"
  // Chart-only hues. Series colours are graphics rather than text, so they
  // answer to WCAG's 3:1 non-text rule against the surface they sit on.
  | "chartRate"
  | "chartBudget";

export type Palette = Record<ColorToken, string>;

/**
 * `band` is the sheet's full-width section strip (Income, Expenses) and the
 * marketing page's dark bands. It is named for its job rather than its colour
 * because it inverts: on a white page the band is near-black, and on a dark
 * page it is a *lighter* surface than the page. Calling it `canvasDark` — as
 * it used to be — would be a lie in half the app.
 */
export const lightPalette: Palette = {
  primary: "#000000",
  onPrimary: "#FFFFFF",
  ink: "#000000",
  inkSoft: "#1B1B1B",
  body: "#525252",
  // bodyMuted and dim carry real text — muted labels, £0 amounts, chart axis
  // ticks — at 11-13px, so both clear 4.5:1 against canvas *and* canvasSoft.
  bodyMuted: "#6E6E6E",
  dim: "#717171",
  hairline: "#E5E5E5",
  hairlineStrong: "#D4D4D4",
  canvas: "#FFFFFF",
  canvasSoft: "#F7F7F7",
  band: "#0F1116",
  bandSoft: "#1A1D23",
  onBand: "#FFFFFF",
  bodyOnBand: "#A8AFBC",
  hairlineBand: "#1F242C",
  // Sign colours double as text on amount cells, so they answer to the same
  // 4.5:1 floor.
  positive: "#1A7A43",
  negative: "#B33B3B",
  focus: "#0F1116",
  // The single highlight accent. Used sparingly — period dates in eyebrows,
  // selected rows, anything the user should locate at a glance.
  accent: "#1E5BC6",
  chartRate: "#D97706",
  // The budget reference line. Was #9CA3AF, which came to 2.54:1 on white and
  // failed the 3:1 non-text rule — the line a user is meant to compare against
  // was the faintest thing on the chart.
  chartBudget: "#7E8794",
};

/**
 * Not an inversion of the light palette — an inverted neutral ramp with its own
 * steps, chosen against the dark surfaces and checked with the same 4.5:1 rule
 * (see contrast.test.ts, which asserts every text token against all three dark
 * surfaces).
 *
 * Surfaces get *lighter* as they rise: canvas → canvasSoft (header, subtotal
 * and group rows) → band (section strips). That preserves the light mode's
 * reading — a band separates groups of rows — by flipping which direction
 * counts as raised, rather than by keeping the band literally dark, which on a
 * dark page would separate nothing.
 *
 * The sign hues stay recognisably the same green and red, lightened until they
 * clear the floor: a colour tuned for white text-on-paper goes muddy on a dark
 * surface.
 */
export const darkPalette: Palette = {
  // The black CTA pill becomes a light one; its label goes dark to match.
  primary: "#F2F4F7",
  onPrimary: "#0F1116",
  ink: "#F2F4F7",
  inkSoft: "#E4E7EC",
  body: "#B9C0CC",
  bodyMuted: "#9AA3B2",
  dim: "#8B95A5",
  hairline: "#262B33",
  hairlineStrong: "#333A44",
  canvas: "#0F1116",
  canvasSoft: "#1A1D23",
  band: "#262B33",
  bandSoft: "#1A1D23",
  onBand: "#FFFFFF",
  bodyOnBand: "#B9C0CC",
  hairlineBand: "#333A44",
  positive: "#4CAF7D",
  negative: "#F1837B",
  // Light, so the ring reads against a dark page — the mirror of the light
  // mode's near-black ring on white.
  focus: "#F2F4F7",
  accent: "#7FA6FF",
  chartRate: "#E9A23B",
  chartBudget: "#828C99",
};

export const cssVariableName = (token: string) => `--c-${token}`;

/** Renders a palette as the body of a CSS rule. */
export const paletteToCss = (palette: Palette): string =>
  Object.entries(palette)
    .map(([token, value]) => `  ${cssVariableName(token)}: ${value};`)
    .join("\n");
