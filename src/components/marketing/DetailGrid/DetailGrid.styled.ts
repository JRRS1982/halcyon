import styled, { css } from "styled-components";

export const Inner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

export const Section = styled.section`
  ${({ theme }) => css`
    padding: ${theme.spacing["3xl"]} 0 ${theme.spacing.section};
  `}
`;

// Fifteen cells in one uninterrupted grid is a wall to scan, so each group
// gets its own labelled block of three — one row at desktop width.
export const GroupTitle = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    color: ${theme.colors.accent};
    margin: ${theme.spacing["3xl"]} 0 0;
    padding-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.ink};
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

// A brief: a short ruled item in its column.
export const Cell = styled.div`
  padding: ${({ theme }) => `${theme.spacing.md} 0 ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
`;

export const Key = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
