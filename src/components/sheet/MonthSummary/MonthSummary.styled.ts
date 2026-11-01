import styled, { css } from "styled-components";

// The past-months table under the budget and balance sheets. Opened by an ink
// rule and its own heading like every other ruled section, and set at the
// sheet's reading size so it reads as part of the page, not a footnote.
export const SummaryStrip = styled.section`
  overflow-x: auto;
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid ${({ theme }) => theme.colors.ink};

  @media (max-width: 767px) {
    display: none;
  }
`;

export const SummaryHeading = styled.h2`
  ${({ theme }) => css`
    margin: 0 0 ${theme.spacing.md};
    font-family: ${theme.typography.amountXl.family};
    font-size: ${theme.typography.amountXl.size};
    font-weight: ${theme.typography.amountXl.weight};
    letter-spacing: ${theme.typography.amountXl.letterSpacing};
    color: ${theme.colors.ink};
  `}
`;

export const SummaryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const SummaryTh = styled.th<{ $right?: boolean }>`
  ${({ theme }) => css`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    font-family: ${theme.typography.control.family};
    font-size: ${theme.typography.control.size};
    font-weight: ${theme.typography.control.weight};
    color: ${theme.colors.body};
    border-bottom: 1px solid ${theme.colors.ink};
  `}
  text-align: ${({ $right }) => ($right ? "right" : "left")};
`;

export const SummaryTr = styled.tr<{ $current?: boolean }>`
  background: ${({ theme, $current }) =>
    $current ? theme.colors.canvasSoft : "transparent"};
  font-weight: ${({ $current }) => ($current ? 600 : 400)};
`;

export const SummaryTd = styled.td<{
  $right?: boolean;
  $tone?: "positive" | "negative" | "dim";
}>`
  ${({ theme, $tone }) => css`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.hairline};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    font-variant-numeric: tabular-nums;
    color: ${
      $tone === "positive"
        ? theme.colors.positive
        : $tone === "negative"
          ? theme.colors.negative
          : $tone === "dim"
            ? theme.colors.dim
            : theme.colors.ink
    };
  `}
  text-align: ${({ $right }) => ($right ? "right" : "left")};
`;
