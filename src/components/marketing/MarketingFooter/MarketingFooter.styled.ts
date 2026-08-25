import Link from "next/link";
import styled, { css } from "styled-components";

export const Inner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

export const Foot = styled.footer`
  ${({ theme }) => css`
    background: ${theme.colors.canvas};
    border-top: 1px solid ${theme.colors.hairline};
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: ${({ theme }) => theme.spacing["4xl"]};

  /* One column would put eight links in a single scroll-heavy stack. The two
     link groups sit side by side instead, both reachable without scrolling,
     with the brand block spanning the full width above them. */
  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.spacing["3xl"]}
      ${({ theme }) => theme.spacing["2xl"]};

    > :first-child {
      grid-column: 1 / -1;
    }
  }
`;

export const Brand = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const Blurb = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    max-width: 30ch;
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const ColTitle = styled.h4`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0 0 ${theme.spacing.md};
  `}
`;

export const FootLink = styled(Link)`
  ${({ theme }) => css`
    display: block;
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.ink};
    text-decoration: none;
    margin-bottom: ${theme.spacing.sm};
  `}
`;
