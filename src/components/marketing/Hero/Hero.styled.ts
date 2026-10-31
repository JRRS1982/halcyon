import Link from "next/link";
import styled, { css } from "styled-components";

// The landing page opens as a money section's front: a masthead headline over
// a double rule, a dateline, then three ruled columns (the method, what you'll
// read, what Balanced never does) with the sign-up box in the last.
export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing["2xl"]} 0 ${theme.spacing["3xl"]}`};
`;

export const Masthead = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 900;
    font-size: clamp(44px, 7vw, 84px);
    line-height: 1;
    letter-spacing: -0.015em;
    text-align: center;
    color: ${theme.colors.ink};
    padding-bottom: ${theme.spacing.md};
    border-bottom: 4px double ${theme.colors.ink};
  `}
`;

export const Dateline = styled.p`
  ${({ theme }) => css`
    display: flex;
    justify-content: space-between;
    gap: ${theme.spacing.lg};
    padding: ${theme.spacing.sm} 0;
    border-bottom: 1px solid ${theme.colors.ink};
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    text-transform: uppercase;
    color: ${theme.colors.ink};

    span:nth-child(2) {
      color: ${theme.colors.accent};
    }

    @media (max-width: 760px) {
      flex-direction: column;
      gap: ${theme.spacing.xs};
      span:nth-child(3) {
        display: none;
      }
    }
  `}
`;

export const Columns = styled.div`
  display: grid;
  grid-template-columns: 1.05fr 1.5fr 1fr;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const Column = styled.div`
  ${({ theme }) => css`
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
    border-right: 1px solid ${theme.colors.hairlineStrong};

    &:first-child {
      padding-left: 0;
    }
    &:last-child {
      padding-right: 0;
      border-right: none;
    }

    @media (max-width: 1023px) {
      &:nth-child(2) {
        border-right: none;
        padding-right: 0;
      }
      &:last-child {
        grid-column: 1 / -1;
        padding-left: 0;
        border-top: 1px solid ${theme.colors.ink};
      }
    }
    @media (max-width: 760px) {
      padding: ${theme.spacing.lg} 0;
      border-right: none;
      & + & {
        border-top: 1px solid ${theme.colors.ink};
      }
    }
  `}
`;

export const Kicker = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    text-transform: uppercase;
    color: ${theme.colors.accent};
  `}
`;

export const Lead = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-weight: 700;
    font-size: 34px;
    line-height: 1.08;
    color: ${theme.colors.ink};
    margin-top: ${theme.spacing.xs};
  `}
`;

export const Head = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 24px;
    line-height: 1.15;
    color: ${theme.colors.ink};
    margin: ${theme.spacing.xs} 0 ${theme.spacing.md};
  `}
`;

export const Dek = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-style: italic;
    font-weight: 600;
    font-size: 19px;
    line-height: 1.35;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.md};
  `}
`;

export const Body = styled.p`
  font-size: 15.5px;
  line-height: 1.6;
  margin-top: ${({ theme }) => theme.spacing.md};
`;

export const Steps = styled.ol`
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-left: 22px;
  font-size: 15.5px;
  line-height: 1.8;
`;

export const Caption = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-style: italic;
    font-size: 14px;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.sm};
  `}
`;

export const Never = styled.ul`
  list-style: none;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

export const NeverItem = styled.li`
  ${({ theme }) => css`
    padding: ${theme.spacing.md} 0;
    border-bottom: 1px solid ${theme.colors.hairlineStrong};
    font-size: 15px;
    line-height: 1.5;
    color: ${theme.colors.body};

    b {
      display: block;
      font-family: ${theme.typography.displayLg.family};
      font-size: 17px;
      color: ${theme.colors.ink};
    }
  `}
`;

export const TrustLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: underline;
  text-underline-offset: 2px;
`;

export const SignUpBox = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.spacing.xl};
    padding: ${theme.spacing.lg};
    border: 2px solid ${theme.colors.ink};
    background: ${theme.colors.canvasSoft};
  `}
`;

export const BoxTitle = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 22px;
    line-height: 1.2;
  `}
`;

export const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const linkButton = css`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.control.family};
    font-size: 15px;
    font-weight: ${theme.typography.control.weight};
    text-decoration: none;
  `}
`;

export const PrimaryLink = styled(Link)`
  ${linkButton}
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  border: 1px solid ${({ theme }) => theme.colors.primary};
`;

export const OutlineLink = styled(Link)`
  ${linkButton}
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid ${({ theme }) => theme.colors.ink};
`;
