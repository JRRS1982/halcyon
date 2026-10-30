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
  | "chartBudget"
  // The plan's categorical slots — one per asset wrapper. Series colours are
  // graphics, so they answer to the 3:1 non-text rule, and as a *set* they also
  // have to stay apart from one another under colour-vision deficiency. Both
  // schemes are checked by the dataviz palette validator; see the note on
  // planChartPalette below.
  | "chartCash"
  | "chartIsa"
  | "chartGia"
  | "chartProperty"
  | "chartOtherAsset"
  | "chartPension"
  | "chartDbPension"
  // One colour per spending section (Fixed / Variable / Discretionary), used
  // wherever that section appears: its budget heading, its share bars, its
  // dashboard chart. Graphics, so 3:1 against the page.
  | "sectionFixed"
  | "sectionVariable"
  | "sectionDiscretionary";

export type Palette = Record<ColorToken, string>;

/**
 * `band` is the sheet's full-width section strip (Income, Expenses) and the
 * marketing page's dark bands. It is named for its job rather than its colour
 * because it inverts: on a white page the band is near-black, and on a dark
 * page it is a *lighter* surface than the page. Calling it `canvasDark` — as
 * it used to be — would be a lie in half the app.
 */
export const lightPalette: Palette = {
  primary: "#1B4E8A",
  onPrimary: "#FFFFFF",
  ink: "#26211E",
  inkSoft: "#38302B",
  body: "#4D443E",
  // bodyMuted and dim carry real text — muted labels, £0 amounts, chart axis
  // ticks — at 11-13px, so both clear 4.5:1 against canvas *and* canvasSoft.
  bodyMuted: "#5E544C",
  dim: "#62574F",
  hairline: "#E9D2BE",
  hairlineStrong: "#D8BBA2",
  canvas: "#FCEEE2",
  canvasSoft: "#F6E1CF",
  band: "#EED3BD",
  bandSoft: "#F6E1CF",
  onBand: "#26211E",
  bodyOnBand: "#4D443E",
  hairlineBand: "#D8BBA2",
  // Sign colours double as text on amount cells, so they answer to the same
  // 4.5:1 floor.
  positive: "#0B6A4C",
  negative: "#A3271F",
  focus: "#1B4E8A",
  // The single highlight accent. Used sparingly — period dates in eyebrows,
  // selected rows, anything the user should locate at a glance.
  accent: "#8E1B3D",
  chartRate: "#B4530A",
  // The budget reference line. Was #9CA3AF, which came to 2.54:1 on white and
  // failed the 3:1 non-text rule — the line a user is meant to compare against
  // was the faintest thing on the chart.
  chartBudget: "#776C63",
  chartCash: "#0E7C96",
  chartIsa: "#15803D",
  chartGia: "#7C3AED",
  chartProperty: "#A66A00",
  chartOtherAsset: "#BE185D",
  chartPension: "#1D4ED8",
  chartDbPension: "#C2410C",
  sectionFixed: "#1B4E8A",
  sectionVariable: "#B4530A",
  sectionDiscretionary: "#8E1B3D",
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
  primary: "#9DC1F0",
  onPrimary: "#141A22",
  ink: "#F7EEE6",
  inkSoft: "#EADFD5",
  body: "#D3C5B8",
  bodyMuted: "#B8A99B",
  dim: "#AE9F91",
  hairline: "#362E28",
  hairlineStrong: "#4A3F37",
  canvas: "#1C1815",
  canvasSoft: "#27211D",
  band: "#352C26",
  bandSoft: "#27211D",
  onBand: "#FFFFFF",
  bodyOnBand: "#D3C5B8",
  hairlineBand: "#4A3F37",
  positive: "#5FC79C",
  negative: "#F38E80",
  // Light, so the ring reads against a dark page — the mirror of the light
  // mode's near-black ring on white.
  focus: "#F7EEE6",
  accent: "#F28FAC",
  chartRate: "#E9A23B",
  chartBudget: "#8C8177",
  chartCash: "#359DD1",
  chartIsa: "#5AA33F",
  chartGia: "#9B7BE0",
  chartProperty: "#C08329",
  chartOtherAsset: "#D06B95",
  chartPension: "#5B8DEF",
  chartDbPension: "#D96A45",
  sectionFixed: "#7FA9E6",
  sectionVariable: "#E39A4F",
  sectionDiscretionary: "#E58AA6",
};

export const cssVariableName = (token: string) => `--c-${token}`;

/** Renders a palette as the body of a CSS rule. */
export const paletteToCss = (palette: Palette): string =>
  Object.entries(palette)
    .map(([token, value]) => `  ${cssVariableName(token)}: ${value};`)
    .join("\n");

/**
 * Why these seven, and what they do not achieve.
 *
 * The previous set had two slots (DB pension, Other) sitting below the chroma
 * floor — they read as grey, which in this app means "no data" — and two
 * (Cash, Other) below 3:1 against the page, so the faintest series was the one
 * a user was least likely to recognise. Both schemes now clear the lightness
 * band, the chroma floor, 3:1 contrast, and adjacent-pair separation under
 * simulated protanopia, deuteranopia and tritanopia.
 *
 * What they do not achieve is all-pairs separation. Seven hues cannot be made
 * mutually distinguishable under CVD at a lightness that also clears 3:1 on the
 * page: blue↔violet and amber↔vermillion collide whichever way the set is
 * chosen, and the validator fails an all-pairs check on as few as four hues
 * containing both a green and an amber. The remedy is not a better palette —
 * it is a second channel (texture or dash, as BalanceTrendChart already uses to
 * tell its categories apart) or fewer simultaneous series. That is a change to
 * the charts rather than to these values, and is deliberately left alone here.
 */
