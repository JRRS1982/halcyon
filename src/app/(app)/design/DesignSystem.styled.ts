"use client";

import styled, { css } from "styled-components";

// A design reference is scanned, not read start to finish, and DESIGN.md's
// widest table has six columns — so the page is wider than the legal shell
// while its running text keeps the same 680 px measure. Tables and the swatch
// board are allowed the full width.
export const DesignShell = styled.main`
  max-width: 900px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};

  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

export const Prose = styled.div`
  /* Running text only. Headings are short, and holding them to the measure
     would clip the section rule below to 680 px of a 900 px column. */
  p,
  ul,
  ol {
    max-width: 680px;
  }

  h2 {
    margin-top: ${({ theme }) => theme.spacing["4xl"]};
    padding-top: ${({ theme }) => theme.spacing.lg};
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  }

  /* The legal pages' 16ch cell floor suits their three-column tables. The
     widest table here has six columns, where that floor pushes the last one
     off the edge of the column — these can share the width instead, and the
     wrapper's horizontal scroll stays as the phone-width fallback. */
  th,
  td {
    /* 6ch, not 16: enough that a "28 px" cell stays on one line, little
       enough that six columns still fit the page. */
    min-width: 6ch;
  }
`;

export const Rule = styled.hr`
  margin: ${({ theme }) => theme.spacing["3xl"]} 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const label = css`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
`;

export const MonoLabel = styled.span`
  ${label}
  color: ${({ theme }) => theme.colors.dim};
`;

// The "how to use this" block and the token-contract appendix. Hairline frame,
// 4 px radius, no shadow — the canonical panel per DESIGN.md -> Elevation.
export const Panel = styled.section`
  margin: ${({ theme }) => theme.spacing["2xl"]} 0
    ${({ theme }) => theme.spacing["3xl"]};
  padding: ${({ theme }) => theme.spacing.xl};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

export const PanelTitle = styled.h2`
  ${label}
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.dim};
`;

export const Mono = styled.code`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
  word-break: break-all;
`;

export const Contents = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing["3xl"]};
`;

export const ContentsLink = styled.a`
  ${label}
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const Board = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing["3xl"]};
`;

// The generated boards (colour, type) sit at the same level as DESIGN.md's own
// `##` sections, so they are set as the same heading.
export const BoardTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

export const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

export const Swatch = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  overflow: hidden;
`;

// The fill is the live custom property, so the chip shows the colour the
// reader's own scheme is actually running — not a hex frozen into the page.
export const Chip = styled.div`
  height: 56px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

export const SwatchMeta = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.md};
`;

export const TokenName = styled.div`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.ink};
  word-break: break-all;
`;

export const HexRow = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;

  dt {
    ${label}
    color: ${({ theme }) => theme.colors.dim};
  }

  dd {
    margin: 0;
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: 12px;
    color: ${({ theme }) => theme.colors.body};
  }
`;

export const Specimens = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

export const Specimen = styled.div`
  display: grid;
  grid-template-columns: 9ch 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: baseline;
  padding: ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 599px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.xs};
  }
`;

export const SpecimenSize = styled.div`
  ${label}
  color: ${({ theme }) => theme.colors.dim};
`;

export const SpecimenSample = styled.div`
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
`;

export const Contract = styled.details`
  margin-top: ${({ theme }) => theme.spacing["4xl"]};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  padding-top: ${({ theme }) => theme.spacing.lg};

  summary {
    ${label}
    color: ${({ theme }) => theme.colors.accent};
    cursor: pointer;
  }
`;

export const ContractSource = styled.pre`
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
  overflow-x: auto;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 12px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;
