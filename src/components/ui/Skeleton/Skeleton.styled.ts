"use client";

import styled, { css, keyframes } from "styled-components";

// DESIGN.md bans decorative animation, and a pulse is the one exception worth
// making: a wholly static grey page reads as broken content rather than
// content on its way. Kept slow and low-amplitude so it registers as "working"
// without drawing the eye, and dropped entirely for reduced-motion users.
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

export const Bar = styled.span<{ $width: string; $height: string }>`
  ${({ theme, $width, $height }) => css`
    display: block;
    width: ${$width};
    height: ${$height};
    background: ${theme.colors.canvasSoft};
    border-radius: ${theme.rounded.sm};
    animation: ${pulse} 1.6s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

// Mirrors the page shells (max-width + gutters) so the skeleton occupies the
// same footprint as the content it stands in for and nothing jumps on swap.
export const Shell = styled.div<{ $maxWidth: string }>`
  ${({ theme, $maxWidth }) => css`
    /* Rendered as <output>, which is inline by default. */
    display: block;
    max-width: ${$maxWidth};
    margin: 0 auto;
    padding: ${theme.spacing["3xl"]} ${theme.spacing["2xl"]}
      ${theme.spacing["5xl"]};

    @media (max-width: 767px) {
      padding-left: ${theme.spacing.lg};
      padding-right: ${theme.spacing.lg};
    }
  `}
`;

export const HeaderRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${theme.spacing["2xl"]};
    margin-bottom: ${theme.spacing.xl};

    @media (max-width: 767px) {
      flex-direction: column;
      align-items: stretch;
    }
  `}
`;

export const HeaderLeft = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  flex: 1;
  min-width: 0;
`;

// A row of toolbar-height chips standing in for the sheet toolbar.
export const ToolbarRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.sm} 0;
    border-top: 1px solid ${theme.colors.hairline};
    border-bottom: 1px solid ${theme.colors.hairline};
  `}
`;

export const Panel = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    background: ${theme.colors.canvas};
    padding: ${theme.spacing.xl};
    display: grid;
    gap: ${theme.spacing.md};
  `}
`;

export const PanelStack = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
`;

export const PanelGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
`;

// The sheet outline: hairline box, soft header strip, then plain rows.
export const SheetBox = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    overflow: hidden;
  `}
`;

export const SheetLine = styled.div<{ $tone: "head" | "band" | "row" }>`
  ${({ theme, $tone }) => css`
    display: grid;
    grid-template-columns: 1fr 150px 150px;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.hairline};
    background: ${
      $tone === "band"
        ? theme.colors.canvasDark
        : $tone === "head"
          ? theme.colors.canvasSoft
          : theme.colors.canvas
    };

    &:last-child {
      border-bottom: none;
    }

    /* On the dark band the soft-grey bar would vanish. */
    ${
      $tone === "band" &&
      css`
      ${Bar} {
        background: ${theme.colors.hairlineDark};
      }
    `
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(120px, 1fr) 80px 80px;
    }
  `}
`;
