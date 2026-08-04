"use client";

import Link from "next/link";
import styled, { css } from "styled-components";

export const Page = styled.main`
  max-width: 380px;
  margin: ${({ theme }) => theme.spacing.section} auto;
  padding: 0 ${({ theme }) => theme.spacing.lg};
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
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Lead = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.xs} 0 0;
  `}
`;

export const Card = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.spacing["2xl"]};
    padding: ${theme.spacing["2xl"]};
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
  `}
`;

export const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const Label = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
  `}
`;

export const Input = styled.input`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.ink};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairlineStrong};
    border-radius: ${theme.rounded.sm};
    transition: border-color 100ms, box-shadow 100ms;

    &::placeholder {
      color: ${theme.colors.dim};
    }

    &:focus {
      outline: none;
      border-color: ${theme.colors.focus};
      box-shadow: 0 0 0 1px ${theme.colors.focus};
    }
  `}
`;

export const Divider = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    margin: ${theme.spacing.sm} 0;
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.dim};

    &::before,
    &::after {
      content: "";
      flex: 1;
      height: 1px;
      background: ${theme.colors.hairline};
    }
  `}
`;

export const Alert = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.negative};
    margin: ${theme.spacing["2xl"]} 0 0;
  `}
`;

export const Success = styled.output`
  ${({ theme }) => css`
    display: block;
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.positive};
    margin: ${theme.spacing["2xl"]} 0 0;
  `}
`;

// Neutral counterpart to Alert/Success: states a fact about the last session
// rather than reporting a failure or a win.
export const Notice = styled.output`
  ${({ theme }) => css`
    display: block;
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing["2xl"]} 0 0;
  `}
`;

export const Footnote = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    text-align: center;
    margin: ${theme.spacing.xl} 0 0;
  `}
`;

export const FootLink = styled(Link)`
  color: ${({ theme }) => theme.colors.ink};
  font-weight: ${({ theme }) => theme.typography.bodyMdStrong.weight};
  text-decoration: underline;
  text-underline-offset: 2px;
`;
