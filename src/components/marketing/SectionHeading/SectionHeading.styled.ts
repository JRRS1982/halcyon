import styled, { css } from "styled-components";

// An inside page's section head: a heavy ink rule across the page, then the
// kicker, serif title and standfirst, set left like the rest of the paper.
export const Wrap = styled.div`
  border-top: 3px solid ${({ theme }) => theme.colors.ink};
  padding-top: ${({ theme }) => theme.spacing.md};

  > * {
    max-width: 62ch;
  }
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    color: ${theme.colors.accent};
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
    font-size: 17px;
    margin: ${theme.spacing.md} 0 0;
  `}
`;
