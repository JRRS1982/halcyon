import styled, { css } from "styled-components";

// The page's closing story: ruled like every other section, set left, with
// the same actions and trust line as the front page.
export const Band = styled.section`
  ${({ theme }) => css`
    padding: ${theme.spacing["3xl"]} 0 ${theme.spacing.section};
    border-top: 3px solid ${theme.colors.ink};
  `}
`;

export const Title = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: clamp(28px, 3.2vw, 40px);
    line-height: 1.1;
    color: ${theme.colors.ink};
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-size: 18px;
    line-height: 1.5;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
    max-width: 62ch;
  `}
`;
