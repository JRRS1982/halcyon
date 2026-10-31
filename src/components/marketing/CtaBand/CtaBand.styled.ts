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
    max-width: 720px;
    margin: 0 auto ${theme.spacing.section};
    padding: ${theme.spacing["2xl"]};
    border: 2px solid ${theme.colors.ink};
    background: ${theme.colors.canvasSoft};
    color: ${theme.colors.ink};
    text-align: center;
  `}
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
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

// The sign-up panel's action: the primary button.
export const InvertedCta = styled(Link)`
  ${({ theme }) => css`
    display: inline-block;
    margin-top: ${theme.spacing["3xl"]};
    font-family: ${theme.typography.control.family};
    font-size: ${theme.typography.control.size};
    font-weight: ${theme.typography.control.weight};
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    text-decoration: none;
    white-space: nowrap;
  `}
`;
