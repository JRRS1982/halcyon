import styled, { css } from "styled-components";

// The inside pages: four articles, one per feature, each with a picture of
// the feature at work. A heavy rule opens the section; hairlines divide the
// articles as a paper divides its columns.
export const Section = styled.section`
  ${({ theme }) => css`
    padding: ${theme.spacing["3xl"]} 0;
    border-top: 3px solid ${theme.colors.ink};
  `}
`;

export const SectionHead = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: clamp(28px, 3.2vw, 40px);
    line-height: 1.1;
    color: ${theme.colors.ink};
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing.xl};

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

export const Article = styled.article`
  ${({ theme }) => css`
    padding: ${theme.spacing.xl} ${theme.spacing["2xl"]} ${theme.spacing["2xl"]} 0;
    border-top: 1px solid ${theme.colors.ink};
    scroll-margin-top: ${theme.spacing["3xl"]};

    &:nth-child(even) {
      padding: ${theme.spacing.xl} 0 ${theme.spacing["2xl"]} ${theme.spacing["2xl"]};
      border-left: 1px solid ${theme.colors.hairlineStrong};
    }

    @media (max-width: 860px) {
      &,
      &:nth-child(even) {
        padding: ${theme.spacing.xl} 0;
        border-left: none;
      }
    }
  `}
`;

export const Title = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 26px;
    line-height: 1.15;
    text-wrap: balance;
    color: ${theme.colors.ink};
    margin-top: ${theme.spacing.md};
  `}
`;

export const Body = styled.p`
  ${({ theme }) => css`
    font-size: 16px;
    line-height: 1.6;
    color: ${theme.colors.ink};
    margin-top: ${theme.spacing.sm};
    max-width: 62ch;
  `}
`;
