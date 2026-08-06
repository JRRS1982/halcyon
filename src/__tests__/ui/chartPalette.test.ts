// The plan's asset-wrapper colours, checked as a set.
//
// These were tuned with the dataviz palette validator, which doesn't run in CI
// — so the properties it checked are asserted here instead. Without that, the
// next person to nudge a hue by eye has nothing telling them they've pushed a
// slot back under the floor, which is exactly how two of them ended up grey.
//
// Reads the palettes directly: theme.colors resolves to var(--c-…) at runtime,
// and a CSS variable name has no colour.
import { type Palette, darkPalette, lightPalette } from "@/lib/palette";

const WRAPPER_TOKENS = [
  "chartCash",
  "chartIsa",
  "chartGia",
  "chartProperty",
  "chartOtherAsset",
  "chartPension",
  "chartDbPension",
] as const;

const srgbToLinear = (c: number) =>
  c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const channels = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map(srgbToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
};

// Chroma as the spread between the strongest and weakest channel. Crude next to
// OKLCh, but it answers the only question being asked: is this a colour, or is
// it a grey wearing a colour's name? The old #94A3B8 scores 0.09 here.
const chroma = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
};

// WCAG asks 3:1 of any graphic that has to be perceivable.
const NON_TEXT = 3;
const GREY_CEILING = 0.12;

describe.each([
  ["light", lightPalette],
  ["dark", darkPalette],
] as const)("plan chart palette (%s)", (_name, palette: Palette) => {
  test.each(WRAPPER_TOKENS)("%s is a colour, not a grey", (token) => {
    expect(chroma(palette[token])).toBeGreaterThan(GREY_CEILING);
  });

  test.each(WRAPPER_TOKENS)("%s clears 3:1 against the page", (token) => {
    expect(contrast(palette[token], palette.canvas)).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
  });

  // Two series painted the same colour are two series a reader cannot tell
  // apart, whatever else is true of them.
  test("every slot is distinct", () => {
    const values = WRAPPER_TOKENS.map((t) => palette[t]);
    expect(new Set(values).size).toBe(values.length);
  });
});

// A dark scheme that reuses the light hues is the classic mistake: they were
// picked against white and go muddy on a dark surface.
test("the two schemes use different values for every slot", () => {
  const shared = WRAPPER_TOKENS.filter(
    (token) => lightPalette[token] === darkPalette[token],
  );
  expect(shared).toEqual([]);
});
