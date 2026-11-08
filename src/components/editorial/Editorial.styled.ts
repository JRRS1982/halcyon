import Link from "next/link";
import styled, { css } from "styled-components";

// The public site's editorial pieces, set as a financial paper sets them:
// serif headlines, short ruled columns, pictures with italic captions. Shared
// by the front page, the features index and each article page.

export const Page = styled.main`
  ${({ theme }) => css`
    max-width: 1240px;
    margin: 0 auto;
    padding: ${theme.spacing["2xl"]} ${theme.spacing["2xl"]} ${theme.spacing.section};

    @media (max-width: 760px) {
      padding: ${theme.spacing.xl} ${theme.spacing.lg} ${theme.spacing["4xl"]};
    }
  `}
`;

export const Headline = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: clamp(38px, 4.8vw, 64px);
    line-height: 1.04;
    letter-spacing: -0.015em;
    text-wrap: balance;
    color: ${theme.colors.ink};
  `}
`;

export const Standfirst = styled.p`
  ${({ theme }) => css`
    text-wrap: pretty;
    font-size: 20px;
    line-height: 1.45;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.md};
    max-width: 60ch;

    @media (max-width: 760px) {
      font-size: 18px;
    }
  `}
`;

export const SectionHead = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: clamp(26px, 3vw, 36px);
    line-height: 1.1;
    color: ${theme.colors.ink};
  `}
`;

export const Rule = styled.hr`
  border: none;
  border-top: 3px solid ${({ theme }) => theme.colors.ink};
  margin: ${({ theme }) => `${theme.spacing["3xl"]} 0 ${theme.spacing.lg}`};
`;

export const Figure = styled.figure`
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

export const Caption = styled.figcaption`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    text-wrap: pretty;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
  `}
`;

export const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const linkButton = css`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 ${theme.spacing.xl};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.control.family};
    font-size: 16px;
    font-weight: ${theme.typography.control.weight};
    text-decoration: none;
  `}
`;

export const PrimaryLink = styled(Link)`
  ${linkButton}
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  border: 1px solid ${({ theme }) => theme.colors.primary};

  &:hover {
    filter: brightness(0.88);
  }
`;

export const OutlineLink = styled(Link)`
  ${linkButton}
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid ${({ theme }) => theme.colors.ink};

  &:hover {
    background: ${({ theme }) => theme.colors.canvasSoft};
  }
`;

export const Trust = styled.p`
  ${({ theme }) => css`
    text-wrap: pretty;
    font-size: 14px;
    line-height: 1.5;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.md};
    max-width: 60ch;

    a {
      color: ${theme.colors.accent};
      text-underline-offset: 2px;
    }
  `}
`;

// Articles listed as a paper lists them: two columns divided by a hairline,
// each story ruled off from the one above. The whole story is the link.
export const Stories = styled.div<{ $columns?: 2 | 3 }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns = 2 }) => $columns}, minmax(0, 1fr));

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

export const Story = styled(Link)`
  ${({ theme }) => css`
    display: block;
    padding: ${theme.spacing.xl} ${theme.spacing["2xl"]} ${theme.spacing["2xl"]} 0;
    border-top: 1px solid ${theme.colors.ink};
    color: ${theme.colors.ink};
    text-decoration: none;

    &:nth-child(even) {
      padding: ${theme.spacing.xl} 0 ${theme.spacing["2xl"]} ${theme.spacing["2xl"]};
      border-left: 1px solid ${theme.colors.hairlineStrong};
    }

    /* Three across: the middle and last stories carry the column rule. */
    @media (min-width: 861px) {
      [data-columns="3"] > & {
        padding: ${theme.spacing.xl} ${theme.spacing.xl} ${theme.spacing["2xl"]};
        border-left: 1px solid ${theme.colors.hairlineStrong};
      }
      [data-columns="3"] > &:nth-child(3n + 1) {
        padding-left: 0;
        border-left: none;
      }
      [data-columns="3"] > &:nth-child(3n) {
        padding-right: 0;
      }
    }

    /* A headline under a picture stands a step clear of it. */
    > :is(h2, h3):not(:first-child) {
      margin-top: ${theme.spacing.lg};
    }

    &:hover :is(h2, h3),
    &:focus-visible :is(h2, h3) {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
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

export const StoryTitle = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 26px;
    line-height: 1.15;
    text-wrap: balance;
    margin-top: ${theme.spacing.md};
  `}
`;

export const StoryText = styled.p`
  ${({ theme }) => css`
    text-wrap: pretty;
    font-size: 16px;
    line-height: 1.6;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
    max-width: 60ch;
  `}
`;

export const More = styled.span`
  ${({ theme }) => css`
    display: inline-block;
    margin-top: ${theme.spacing.sm};
    font-weight: 600;
    color: ${theme.colors.accent};
  `}
`;
