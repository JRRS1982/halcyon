"use client";

import type { Wrapper } from "@/lib/plan";
import { WRAPPER_COLOURS } from "./colours";

/**
 * A second channel for the stacked plan charts, so identity is not colour
 * alone.
 *
 * The palette work in the previous change established that seven hues cannot
 * all be told apart under colour-vision deficiency at a lightness that also
 * clears 3:1 on the page — blue↔violet and amber↔vermillion collide whichever
 * way the set is chosen. The fix for that is not more colours; it is a
 * different axis.
 *
 * Texture is applied where it is needed rather than everywhere, so it reads as
 * information and not decoration:
 *
 *   GIA         hatched, because it collides with Pension (blue↔violet)
 *   DB pension  hatched the other way, because it collides with Property
 *   Other       hatched the other way again, so the catch-all is never
 *               mistaken for a specific wrapper it happens to sit beside
 *
 * 45° and its 135° mirror only. Horizontal or vertical hatching reads as
 * gridlines or bars — it competes with the chart's own furniture instead of
 * labelling a series.
 */
export type Texture = "plain" | "hatch" | "hatchMirror";

export const WRAPPER_TEXTURES: Record<Wrapper, Texture> = {
  CASH: "plain",
  ISA: "plain",
  GIA: "hatch",
  PROPERTY: "plain",
  DB_PENSION: "hatch",
  PENSION: "plain",
  OTHER: "hatchMirror",
};

const ANGLE: Record<Exclude<Texture, "plain">, number> = {
  hatch: 45,
  hatchMirror: 135,
};

// Matches the flat areas: same base tint, with the hatch drawn at the same
// weight as the series stroke so textured and plain slots carry equal loudness.
const BASE_OPACITY = 0.18;
const LINE_OPACITY = 0.55;

const patternId = (wrapper: Wrapper) => `plan-texture-${wrapper.toLowerCase()}`;

/**
 * The fill for a wrapper's area: a pattern reference when it is textured, the
 * flat colour when it is not.
 *
 * Textured areas take fillOpacity 1 because the tint is already baked into the
 * pattern — applying the area's own 0.18 on top would fade the hatch to
 * nothing, which is the whole point of it.
 */
export const wrapperFill = (wrapper: Wrapper) =>
  WRAPPER_TEXTURES[wrapper] === "plain"
    ? { fill: WRAPPER_COLOURS[wrapper], fillOpacity: BASE_OPACITY }
    : { fill: `url(#${patternId(wrapper)})`, fillOpacity: 1 };

/**
 * The <defs> block. Render once inside each chart that uses wrapperFill —
 * pattern ids are document-scoped, so two charts on a page share these
 * definitions harmlessly.
 */
export function ChartTextures() {
  const textured = (Object.keys(WRAPPER_TEXTURES) as Wrapper[]).filter(
    (w) => WRAPPER_TEXTURES[w] !== "plain",
  );

  return (
    <defs>
      {textured.map((wrapper) => {
        const texture = WRAPPER_TEXTURES[wrapper] as Exclude<Texture, "plain">;
        const colour = WRAPPER_COLOURS[wrapper];
        return (
          <pattern
            key={wrapper}
            id={patternId(wrapper)}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform={`rotate(${ANGLE[texture]})`}
          >
            <rect
              width={6}
              height={6}
              fill={colour}
              fillOpacity={BASE_OPACITY}
            />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              stroke={colour}
              strokeWidth={1.5}
              strokeOpacity={LINE_OPACITY}
            />
          </pattern>
        );
      })}
    </defs>
  );
}
