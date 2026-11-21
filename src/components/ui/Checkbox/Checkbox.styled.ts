import styled, { css } from "styled-components";
import { hoverFill } from "@/lib/pointer";

// Both marks are masks rather than pictures, so each takes its colour from the
// palette and follows the scheme.
const svgMask = (path: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='${path}' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

const PEN_TICK = svgMask(
  "M2.5 8.6c1.6 1.2 2.8 2.7 3.8 4.6C8.2 8.6 10.6 5 14 2",
);
const PEN_DASH = svgMask("M3.5 8h9");

// Drawn rather than native: the browser's own tick box is a small white
// square with a grey edge, which reads as foreign on the paper ground. This
// one is a box ruled in ink on field paper, ticked by hand: the mark is drawn
// in oxford blue and runs past the box's corner, as a pen tick does.
export const StyledCheckbox = styled.input`
  ${({ theme }) => css`
    appearance: none;
    position: relative;
    flex: none;
    display: inline-grid;
    place-content: center;
    width: 18px;
    height: 18px;
    margin: 0;
    vertical-align: middle;
    border: 1.5px solid ${theme.colors.ink};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.field};
    cursor: pointer;
    transition: background-color 100ms;

    /* The mark: a tick when checked, a dash when only some rows are. */
    &::before {
      content: "";
      width: 22px;
      height: 22px;
      background: ${theme.colors.primary};
      -webkit-mask: ${PEN_TICK} center / contain no-repeat;
      mask: ${PEN_TICK} center / contain no-repeat;
      transform: translate(2px, -3px);
      opacity: 0;
      transition: opacity 100ms;
    }

    /* The target is larger than the box: 40px across, 44px under a finger.
       Insets are measured from inside the 1.5px edge. */
    &::after {
      content: "";
      position: absolute;
      inset: -12.5px;
    }

    @media (pointer: coarse) {
      &::after {
        inset: -14.5px;
      }
    }

    ${hoverFill}

    &:checked::before,
    &:indeterminate::before {
      opacity: 1;
    }

    /* Smaller than the tick, so the dash sits inside the box clear of its edge. */
    &:indeterminate::before {
      width: 14px;
      height: 14px;
      -webkit-mask-image: ${PEN_DASH};
      mask-image: ${PEN_DASH};
      transform: none;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `}
`;
