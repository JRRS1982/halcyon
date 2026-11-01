import Link from "next/link";
import styled, { css } from "styled-components";

// The small print, in plain English: six short ruled briefs in three
// columns, with the rest in the guide.
export const Section = styled.section`
  ${({ theme }) => css`
    padding: ${theme.spacing["3xl"]} 0;
    border-top: 3px solid ${theme.colors.ink};
    scroll-margin-top: ${theme.spacing["3xl"]};
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: ${({ theme }) => theme.spacing["2xl"]};
  margin-top: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

export const Brief = styled.div`
  ${({ theme }) => css`
    padding: ${theme.spacing.md} 0 ${theme.spacing.lg};
    border-top: 1px solid ${theme.colors.ink};
  `}
`;

export const Key = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 18px;
    line-height: 1.25;
    color: ${theme.colors.ink};
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-size: 15px;
    line-height: 1.55;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.xs};
  `}
`;

export const More = styled(Link)`
  display: inline-block;
  margin-top: ${({ theme }) => theme.spacing.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;
