import { WRAPPER_TEXTURES, wrapperFill } from "@/app/(app)/plan/ChartTextures";
import { darkPalette, lightPalette } from "@/lib/palette";
import type { Wrapper } from "@/lib/plan";

/**
 * The pairs colour cannot separate.
 *
 * Established by running both schemes through the dataviz palette validator:
 * blue↔violet and amber↔vermillion collide under simulated protanopia and
 * deuteranopia at any lightness that also clears 3:1 against the page, and no
 * reshuffling of seven hues avoids it. Texture is the second channel that makes
 * these two pairs readable, so it is not optional decoration — losing it takes
 * the chart back to colour-alone identity for exactly these series.
 */
const COLOUR_COLLISIONS: [Wrapper, Wrapper][] = [
  ["PENSION", "GIA"],
  ["PROPERTY", "DB_PENSION"],
];

describe("plan chart textures", () => {
  test.each(
    COLOUR_COLLISIONS,
  )("%s and %s are separated by texture, not just hue", (a, b) => {
    expect(WRAPPER_TEXTURES[a]).not.toBe(WRAPPER_TEXTURES[b]);
  });

  // A pattern fill has to opt out of the area's own fillOpacity: the tint is
  // already baked into the pattern, and multiplying the two fades the hatch to
  // nothing — which would leave the series looking textured in the source and
  // flat on screen.
  test("textured wrappers carry their tint in the pattern", () => {
    const gia = wrapperFill("GIA");
    expect(gia.fill).toMatch(/^url\(#plan-texture-/);
    expect(gia.fillOpacity).toBe(1);
  });

  test("plain wrappers keep the flat colour and the shared opacity", () => {
    const isa = wrapperFill("ISA");
    expect(isa.fill).not.toMatch(/^url\(/);
    expect(isa.fillOpacity).toBeCloseTo(0.18);
  });

  // Texture answers CVD, print and forced-colors — cases where hue is gone
  // entirely — so it must not itself depend on the colour scheme.
  test("the texture assignment is the same in both schemes", () => {
    expect(Object.keys(lightPalette).sort()).toEqual(
      Object.keys(darkPalette).sort(),
    );
    // WRAPPER_TEXTURES is scheme-independent by construction; this pins that
    // it stays a plain map rather than growing a per-scheme branch.
    expect(
      Object.values(WRAPPER_TEXTURES).every((t) => typeof t === "string"),
    ).toBe(true);
  });

  test("every wrapper has an assignment", () => {
    const wrappers: Wrapper[] = [
      "PENSION",
      "ISA",
      "GIA",
      "CASH",
      "PROPERTY",
      "DB_PENSION",
      "OTHER",
    ];
    for (const w of wrappers) {
      expect(WRAPPER_TEXTURES[w]).toBeDefined();
    }
  });
});
