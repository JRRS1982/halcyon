import { theme } from "@/lib/theme";

// How a control answers the pointer. Each is a plain string, so it drops into
// a styled template and into the string-built ones alike.

/**
 * The fill of a boxed, paper-filled control under the pointer (DESIGN.md →
 * Colors → State). Only where a pointer can hover: on a touch screen a tapped
 * button would otherwise keep the fill until something else is tapped.
 *
 * A control that is already filled — the current month, an active toggle —
 * leaves it out.
 */
export const hoverFill = `
  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: ${theme.colors.hover};
    }
  }
`;

/** A text button has no box to fill, so under the pointer its words turn ink. */
export const hoverInk = `
  @media (hover: hover) {
    &:hover:not(:disabled) {
      color: ${theme.colors.ink};
    }
  }
`;

/**
 * Extends a small control's target past its drawn edge: 4px each way, so a
 * 16px button is a 24px target, and 8px under a finger. Kept this modest
 * because the extra reach counts as content — a larger one makes a table or
 * list that just fits its scroll box start to scroll.
 */
export const reach = `
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: -4px;
  }

  @media (pointer: coarse) {
    &::after {
      inset: -8px;
    }
  }
`;

/** The same, above and below only: for a text button that is wide enough but one line tall. */
export const reachTall = `
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: -4px 0;
  }

  @media (pointer: coarse) {
    &::after {
      inset: -8px 0;
    }
  }
`;
