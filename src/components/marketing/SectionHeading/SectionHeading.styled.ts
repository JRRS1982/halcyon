import styled, { css } from "styled-components";

export const Wrap = styled.div`
  max-width: 62ch;
  margin: 0 auto;
  text-align: center;
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

export const Title = styled.h2`
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
    margin: ${theme.spacing.md} auto 0;
  `}
`;
