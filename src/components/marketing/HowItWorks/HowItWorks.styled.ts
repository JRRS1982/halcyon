import styled, { css } from "styled-components";

export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0`};
`;

export const Flow = styled.div`
  max-width: 840px;
  margin: ${({ theme }) => `${theme.spacing["4xl"]} auto 0`};
`;

/* Shares the loop steps' geometry (gutter + marker column) so the one-time
   setup step sits on the same rail as the loop below it. */
export const SetupStep = styled.div`
  ${({ theme }) => css`
    position: relative;
    display: grid;
    grid-template-columns: 32px 1fr;
    column-gap: ${theme.spacing.xl};
    padding-left: 48px;
    padding-bottom: ${theme.spacing["4xl"]};

    &::before {
      content: "";
      position: absolute;
      left: 64px;
      top: 36px;
      bottom: ${theme.spacing.xs};
      width: 1px;
      background: ${theme.colors.hairlineStrong};
    }

    @media (max-width: 760px) {
      padding-left: 32px;

      &::before {
        left: 48px;
      }
    }
  `}
`;

/* The monthly loop: an ordered list of steps with a return path drawn up the
   outside, closing step 4 back onto step 1. */
export const Loop = styled.div`
  ${({ theme }) => css`
    position: relative;
    padding-left: 48px;
    padding-bottom: ${theme.spacing["2xl"]};

    @media (max-width: 760px) {
      padding-left: 32px;
    }
  `}
`;

export const LoopList = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const Step = styled.li`
  ${({ theme }) => css`
    position: relative;
    display: grid;
    grid-template-columns: 32px 1fr;
    column-gap: ${theme.spacing.xl};
    padding-bottom: ${theme.spacing["4xl"]};

    /* The rail: one unbroken line per step, from below the marker to the
       next step's marker. */
    &::before {
      content: "";
      position: absolute;
      left: 16px;
      top: 36px;
      bottom: ${theme.spacing.xs};
      width: 1px;
      background: ${theme.colors.hairlineStrong};
    }

    &:last-child {
      padding-bottom: 0;
    }

    /* The last step's rail runs on to meet the return path below the card. */
    &:last-child::before {
      bottom: -${theme.spacing["2xl"]};
    }
  `}
`;

/* Left, bottom and top-connector lines that carry the loop from the last step
   back up to the first marker. Purely decorative — the copy states the
   monthly rhythm. */
export const ReturnPath = styled.div`
  ${({ theme }) => css`
    position: absolute;
    left: 8px;
    top: 16px;
    bottom: 0;
    width: 40px;
    border-left: 1px solid ${theme.colors.hairlineStrong};
    border-bottom: 1px solid ${theme.colors.hairlineStrong};

    &::before {
      content: "";
      position: absolute;
      top: -1px;
      left: 0;
      right: 0;
      border-top: 1px solid ${theme.colors.hairlineStrong};
    }

    &::after {
      content: "";
      position: absolute;
      top: -5px;
      right: 0;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 5px solid ${theme.colors.hairlineStrong};
    }

    @media (max-width: 760px) {
      left: 4px;
      width: 28px;
    }
  `}
`;

export const ReturnLabel = styled.span`
  ${({ theme }) => css`
    position: absolute;
    left: 0;
    top: 50%;
    transform: translate(-50%, -50%) rotate(180deg);
    writing-mode: vertical-rl;
    background: ${theme.colors.canvas};
    padding: ${theme.spacing.xs} 0;
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    white-space: nowrap;
  `}
`;

export const Marker = styled.span<{ $outline?: boolean }>`
  ${({ theme, $outline }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: ${$outline ? theme.colors.canvas : theme.colors.band};
    color: ${$outline ? theme.colors.ink : theme.colors.onBand};
    border: 1px solid ${$outline ? theme.colors.hairlineStrong : theme.colors.band};
    border-radius: ${theme.rounded.sm};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
  `}
`;

export const StepKey = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
    padding-top: ${theme.spacing.sm};
  `}
`;

export const StepText = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    max-width: 60ch;
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Options = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const OptionCard = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.xl};
  `}
`;

export const Badge = styled.span<{ $accent?: boolean }>`
  ${({ theme, $accent }) => css`
    display: inline-block;
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$accent ? theme.colors.accent : theme.colors.ink};
    border: 1px solid ${$accent ? theme.colors.accent : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.xxs} ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.sm};
  `}
`;

export const OptionTitle = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-size: ${theme.typography.displayLg.size};
    font-weight: ${theme.typography.displayLg.weight};
    line-height: ${theme.typography.displayLg.lineHeight};
    letter-spacing: ${theme.typography.displayLg.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const OptionText = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const FinaleCard = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.band};
    background: ${theme.colors.band};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
  `}
`;

export const FinaleKey = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.onBand};
    margin: 0;
  `}
`;

export const FinaleText = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.bodyOnBand};
    max-width: 60ch;
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
