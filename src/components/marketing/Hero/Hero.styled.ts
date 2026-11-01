import Link from "next/link";
import styled, { css } from "styled-components";

// The landing page's front page, set as a financial paper's: a skybox of
// teasers under the nav, a double ink rule and dateline, then the lead story
// beside a rail holding the sample market-data box and the monthly briefing.
export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.lg} 0 ${theme.spacing["3xl"]}`};
`;

export const Skybox = styled.nav`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  /* On a phone the headline has to lead; the teasers repeat the articles'
     headings, which are a scroll away. */
  @media (max-width: 760px) {
    display: none;
  }
`;

export const Teaser = styled.a`
  ${({ theme }) => css`
    display: block;
    padding: ${theme.spacing.xs} ${theme.spacing.lg};
    border-left: 1px solid ${theme.colors.hairlineStrong};
    color: ${theme.colors.ink};
    text-decoration: none;

    &:first-child {
      padding-left: 0;
      border-left: none;
    }

    &:hover strong {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    @media (max-width: 900px) {
      padding: ${theme.spacing.sm} 0;
      border-left: none;
      & + & {
        border-top: 1px solid ${theme.colors.hairlineStrong};
      }
    }
  `}
`;

export const TeaserText = styled.span`
  ${({ theme }) => css`
    font-size: 14px;
    line-height: 1.4;
    color: ${theme.colors.body};

    strong {
      display: block;
      font-family: ${theme.typography.displayLg.family};
      font-size: 20px;
      line-height: 1.2;
      color: ${theme.colors.ink};
    }
  `}
`;

// The paper's nameplate. Not a heading: the h1 is the lead story's.
export const Nameplate = styled.p`
  ${({ theme }) => css`
    margin-top: ${theme.spacing.lg};
    padding-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.ink};
    font-family: ${theme.typography.displayXl.family};
    font-weight: 900;
    font-size: clamp(36px, 4.2vw, 60px);
    line-height: 1.05;
    letter-spacing: -0.015em;
    text-align: center;
    color: ${theme.colors.ink};

    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Dateline = styled.p`
  ${({ theme }) => css`
    display: flex;
    justify-content: space-between;
    gap: ${theme.spacing.lg};
    margin-top: ${theme.spacing.sm};
    padding: ${theme.spacing.sm} 0;
    border-top: 4px double ${theme.colors.ink};
    border-bottom: 1px solid ${theme.colors.ink};
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    text-transform: uppercase;

    /* On a phone nothing in capitals sits over the headline. */
    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Front = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
`;

export const Lead = styled.article`
  ${({ theme }) => css`
    padding: ${theme.spacing.xl} ${theme.spacing["2xl"]} 0 0;
    border-right: 1px solid ${theme.colors.hairlineStrong};

    @media (max-width: 1023px) {
      padding-right: 0;
      border-right: none;
    }
  `}
`;

export const Headline = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: clamp(40px, 4.8vw, 66px);
    line-height: 1.02;
    letter-spacing: -0.015em;
    text-wrap: balance;
    color: ${theme.colors.ink};
  `}
`;

export const Standfirst = styled.p`
  ${({ theme }) => css`
    font-size: 20px;
    line-height: 1.45;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.md};
    max-width: 62ch;

    @media (max-width: 760px) {
      font-size: 18px;
    }
  `}
`;

export const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
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
    font-size: 14px;
    line-height: 1.5;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.md};
    max-width: 62ch;
  `}
`;

export const TrustLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: underline;
  text-underline-offset: 2px;
`;

export const Picture = styled.figure`
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
`;

// The lead picture is two plates: the page as a desktop shows it, and as a
// phone does, each legible at the size it is shown.
export const Wide = styled.div`
  @media (max-width: 760px) {
    display: none;
  }
`;

export const Narrow = styled.div`
  display: none;
  max-width: 420px;

  @media (max-width: 760px) {
    display: block;
  }
`;

export const Caption = styled.figcaption`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
  `}
`;

export const Rail = styled.aside`
  ${({ theme }) => css`
    padding: ${theme.spacing.xl} 0 0 ${theme.spacing["2xl"]};

    @media (max-width: 1023px) {
      padding-left: 0;
      margin-top: ${theme.spacing["2xl"]};
      border-top: 1px solid ${theme.colors.ink};
    }
  `}
`;

export const RailHead = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 20px;
    line-height: 1.2;
    color: ${theme.colors.ink};
  `}
`;

// The market-data box, as a paper prints the day's indices: a tinted panel
// under an ink rule, one figure per line with its move beside it.
export const Markets = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.spacing.sm};
    border-top: 2px solid ${theme.colors.ink};
    background: ${theme.colors.canvasSoft};
    padding: ${theme.spacing.xs} ${theme.spacing.md} ${theme.spacing.md};
  `}
`;

export const MarketsTable = styled.table`
  ${({ theme }) => css`
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;

    th,
    td {
      padding: ${theme.spacing.sm} 0;
      border-bottom: 1px solid ${theme.colors.hairlineStrong};
      text-align: left;
      vertical-align: baseline;
    }
    th {
      font-size: 14px;
      font-weight: 600;
      color: ${theme.colors.ink};
      vertical-align: middle;
    }
    td {
      text-align: right;
    }
  `}
`;

export const Figure = styled.span`
  ${({ theme }) => css`
    display: block;
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 28px;
    line-height: 1.1;
    color: ${theme.colors.ink};
  `}
`;

export const Move = styled.span<{ $good: boolean }>`
  ${({ theme, $good }) => css`
    font-size: 13px;
    font-weight: 600;
    color: ${$good ? theme.colors.positive : theme.colors.negative};
  `}
`;

export const Note = styled.p`
  ${({ theme }) => css`
    font-size: 13px;
    line-height: 1.45;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
  `}
`;

export const Briefing = styled.section`
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
  scroll-margin-top: ${({ theme }) => theme.spacing["3xl"]};
`;

export const Steps = styled.ol`
  ${({ theme }) => css`
    list-style: none;
    margin-top: ${theme.spacing.sm};
    border-top: 2px solid ${theme.colors.ink};
    counter-reset: step;

    li {
      counter-increment: step;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      padding: ${theme.spacing.md} 0;
      border-bottom: 1px solid ${theme.colors.hairlineStrong};
      font-size: 14px;
      line-height: 1.45;
      color: ${theme.colors.body};
    }
    li::before {
      content: counter(step);
      font-family: ${theme.typography.displayLg.family};
      font-weight: 700;
      font-size: 19px;
      line-height: 1.1;
      color: ${theme.colors.accent};
    }
    strong {
      display: block;
      color: ${theme.colors.ink};
    }
  `}
`;

export const GuideLink = styled(Link)`
  display: inline-block;
  margin-top: ${({ theme }) => theme.spacing.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;
