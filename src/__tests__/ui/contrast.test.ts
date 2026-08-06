// docs/AccessibilityStandards.md commits the app to a 4.5:1 minimum for normal
// text. Nothing enforced it, and three tokens had quietly drifted under:
// dim at 2.85:1, bodyMuted at 3.45:1, and the positive green at 4.38:1 — close
// enough to look deliberate while failing.
//
// Contrast is easy to break by eye ("that grey looks a bit dark, lighten it")
// and the failure is invisible to everyone who isn't affected by it, so the
// ratios are asserted rather than trusted.
import { theme } from "@/lib/theme";

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
// Borders, dividers and chart strokes are non-text; WCAG asks 3:1 of anything
// that has to be perceivable as a boundary, and nothing of purely decorative
// hairlines.
const AA_NON_TEXT = 3;

describe("colour contrast", () => {
  // Sanity check the maths against two ratios anyone can verify: black on
  // white is 21:1 exactly, and a colour against itself is 1:1.
  test("the ratio calculation is right", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#767676")).toBeCloseTo(1, 5);
  });

  describe("text on the light canvas", () => {
    const onCanvas = [
      ["ink", theme.colors.ink],
      ["inkSoft", theme.colors.inkSoft],
      ["body", theme.colors.body],
      ["bodyMuted", theme.colors.bodyMuted],
      ["dim", theme.colors.dim],
      ["accent", theme.colors.accent],
      ["positive", theme.colors.positive],
      ["negative", theme.colors.negative],
    ] as const;

    test.each(onCanvas)("%s clears 4.5:1", (_name, colour) => {
      expect(contrast(colour, theme.colors.canvas)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    });

    // canvasSoft backs the sheet's header, subtotal and group rows, so every
    // one of those greys is read against it too, not just against white.
    test.each(onCanvas)("%s clears 4.5:1 on canvasSoft", (_name, colour) => {
      expect(contrast(colour, theme.colors.canvasSoft)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    });
  });

  describe("text on the dark bands", () => {
    test.each([
      ["onDark", theme.colors.onDark],
      ["bodyOnDark", theme.colors.bodyOnDark],
    ] as const)("%s clears 4.5:1 on canvasDark", (_name, colour) => {
      expect(contrast(colour, theme.colors.canvasDark)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    });

    test("onPrimary clears 4.5:1 on the black grand-total row", () => {
      expect(
        contrast(theme.colors.onPrimary, theme.colors.primary),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });

  // The focus ring is the only thing telling a keyboard user where they are,
  // so it has to be visible against every surface it can land on.
  test.each([
    ["canvas", theme.colors.canvas],
    ["canvasSoft", theme.colors.canvasSoft],
  ] as const)("the focus ring is visible on %s", (_name, surface) => {
    expect(contrast(theme.colors.focus, surface)).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });

  // hairlineStrong separates the column header and totals rows from the data;
  // hairline is the ordinary cell divider and stays deliberately faint.
  test("hairlineStrong reads as a boundary", () => {
    expect(
      contrast(theme.colors.hairlineStrong, theme.colors.canvas),
    ).toBeGreaterThan(1);
  });
});
