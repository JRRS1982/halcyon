"use client";

import styled, { css } from "styled-components";

/**
 * An opened row's panel, drawn as a card hanging off its transaction: it
 * starts under Description, and a notch points up at the toggle that opened
 * it, so it reads as that row's rather than as a row of its own. Shared by the
 * ledger and the import preview. `$notchRight` places the notch under each
 * table's own toggle column.
 */
export const DetailCard = styled.div<{ $notchRight: string }>`
  ${({ theme, $notchRight }) => css`
    position: relative;
    display: grid;
    /* minmax(0, …): the contents shrink to the card, not the card to them. */
    grid-template-columns: minmax(0, 1fr);
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    border: 1px solid ${theme.colors.hairlineStrong};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.field};

    &::before {
      content: "";
      position: absolute;
      top: -7px;
      right: ${$notchRight};
      width: 12px;
      height: 12px;
      background: ${theme.colors.field};
      border-left: 1px solid ${theme.colors.hairlineStrong};
      border-top: 1px solid ${theme.colors.hairlineStrong};
      transform: rotate(45deg);
    }
  `}
`;
