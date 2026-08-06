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

export const Band = styled.section`
  ${({ theme }) => css`
    background: ${theme.colors.band};
    color: ${theme.colors.onBand};
    text-align: center;
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.bodyOnBand};
    margin: 0;
  `}
`;

export const Title = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.onBand};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.bodyOnBand};
    max-width: 48ch;
    margin: ${theme.spacing.md} auto 0;
  `}
`;

// On the dark band the primary CTA inverts to a white fill / ink text — the
// only place this inversion occurs (see DESIGN.md §6).
export const InvertedCta = styled(Link)`
  ${({ theme }) => css`
    display: inline-block;
    margin-top: ${theme.spacing["3xl"]};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    text-decoration: none;
    white-space: nowrap;
  `}
`;
