import styled, { css } from "styled-components";

export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0`};
`;

export const Tree = styled.div`
  margin-top: ${({ theme }) => theme.spacing["4xl"]};
  text-align: center;
`;

export const Node = styled.div<{ $solid?: boolean }>`
  ${({ theme, $solid }) => css`
    display: inline-block;
    text-align: left;
    max-width: 480px;
    border: 1px solid ${$solid ? theme.colors.canvasDark : theme.colors.hairline};
    background: ${$solid ? theme.colors.canvasDark : theme.colors.canvas};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
  `}
`;

export const NodeKey = styled.p<{ $onDark?: boolean }>`
  ${({ theme, $onDark }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$onDark ? theme.colors.onDark : theme.colors.ink};
    margin: 0;
  `}
`;

export const NodeText = styled.p<{ $onDark?: boolean }>`
  ${({ theme, $onDark }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${$onDark ? theme.colors.bodyOnDark : theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Stem = styled.div`
  width: 1px;
  height: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.hairlineStrong};
  margin: 0 auto;
`;

export const Fork = styled.div`
  ${({ theme }) => css`
    width: 62%;
    height: ${theme.spacing["2xl"]};
    border-top: 1px solid ${theme.colors.hairlineStrong};
    border-left: 1px solid ${theme.colors.hairlineStrong};
    border-right: 1px solid ${theme.colors.hairlineStrong};
    margin: 0 auto;

    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Merge = styled.div`
  ${({ theme }) => css`
    width: 62%;
    height: ${theme.spacing["2xl"]};
    border-bottom: 1px solid ${theme.colors.hairlineStrong};
    border-left: 1px solid ${theme.colors.hairlineStrong};
    border-right: 1px solid ${theme.colors.hairlineStrong};
    margin: 0 auto;

    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Branch = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing["4xl"]};
  width: 62%;
  margin: 0 auto;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    width: 100%;
  }
`;

export const BranchCard = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.xl};
    text-align: left;
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

export const BranchTitle = styled.h3`
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

export const BranchText = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
