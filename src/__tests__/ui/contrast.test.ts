// docs/AccessibilityStandards.md commits the app to a 4.5:1 minimum for normal
// text. Nothing enforced it, and three tokens had quietly drifted under.
//
// Contrast is easy to break by eye ("that grey looks a bit dark, lighten it")
// and the failure is invisible to everyone who isn't affected by it, so the
// ratios are asserted rather than trusted. Both schemes are checked: a dark
// palette is a second set of colours with the same obligations, not a filter
// applied to the first.
//
// Reads the palettes directly, not `theme.colors` — those resolve to
// `var(--c-…)` at runtime so the browser can switch schemes, and a CSS variable
// name has no luminance.
import { type Palette, darkPalette, lightPalette } from "@/lib/palette";

// WCAG 2.1 relative luminance. Channels are gamma-expanded, then weighted for
// the eye's sensitivity — which is why green moves the number far more than
// blue does.
const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((i) => {
    const srgb = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
};

const AA_NORMAL_TEXT = 4.5;
// Borders and focus rings are non-text; WCAG asks 3:1 of anything that has to
// be perceivable as a boundary.
const AA_NON_TEXT = 3;

// Every token that renders as text, and every surface it can land on. `band`
// is included because the sheet's section strips and the marketing bands carry
// text too — and it is the tightest surface in the dark scheme.
const TEXT_TOKENS = [
  "ink",
  "inkSoft",
  "body",
  "bodyMuted",
  "dim",
  "accent",
  "positive",
  "negative",
] as const;

const SURFACES = ["canvas", "canvasSoft"] as const;

describe("colour contrast", () => {
  // Sanity check the maths against two ratios anyone can verify: black on
  // white is 21:1 exactly, and a colour against itself is 1:1.
  test("the ratio calculation is right", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#717171", "#717171")).toBeCloseTo(1, 5);
  });

  describe.each([
    ["light", lightPalette],
    ["dark", darkPalette],
  ] as const)("%s scheme", (_name, palette: Palette) => {
    test.each(TEXT_TOKENS)("%s clears 4.5:1 on every surface", (token) => {
      for (const surface of SURFACES) {
        expect(
          contrast(palette[token], palette[surface]),
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });

    test("text on the band clears 4.5:1", () => {
      expect(contrast(palette.onBand, palette.band)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
      expect(contrast(palette.bodyOnBand, palette.band)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    });

    test("the primary button's label clears 4.5:1 on its fill", () => {
      expect(
        contrast(palette.onPrimary, palette.primary),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    // The focus ring is the only thing telling a keyboard user where they are.
    test.each(SURFACES)("the focus ring is visible on %s", (surface) => {
      expect(contrast(palette.focus, palette[surface])).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });

    // The whole point of the band is that it separates itself from the page.
    // In dark mode it is lighter than the canvas rather than darker, and this
    // holds either way.
    test("the band is distinguishable from the canvas", () => {
      expect(contrast(palette.band, palette.canvas)).toBeGreaterThan(1.2);
    });
  });

  // A dark scheme that reuses a light scheme's greys is the classic mistake —
  // they were chosen against white and go muddy on a dark surface.
  test("the two schemes are genuinely different sets of values", () => {
    const shared = TEXT_TOKENS.filter(
      (token) => lightPalette[token] === darkPalette[token],
    );
    expect(shared).toEqual([]);
  });
});
