import { css, keyframes } from "styled-components";

const rise = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
`;

/**
 * The entrance for a surface that opens over the page: a popover, a picker, a
 * dialog. Short enough to read as the surface arriving from its trigger rather
 * than as decoration, and dropped for reduced-motion users.
 */
export const appear = css`
  animation: ${rise} 120ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/** How long a row takes to fade before it is removed from a list. */
export const LEAVE_MS = 160;

/** Fades a row that is about to be removed; pair with a LEAVE_MS timeout. */
export const leaving = css`
  opacity: 0;
  pointer-events: none;
  transition: opacity ${LEAVE_MS}ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
