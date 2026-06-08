import Link from "next/link";
import styled, { css } from "styled-components";

export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0`};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: ${({ theme }) => theme.spacing.section};
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing["3xl"]};
  }
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

export const Title = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const Lead = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    max-width: 50ch;
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const CtaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
`;

const buttonBase = css`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    white-space: nowrap;
    text-decoration: none;
  `}
`;

export const PrimaryLink = styled(Link)`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
`;

export const OutlineLink = styled(Link)`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
`;
